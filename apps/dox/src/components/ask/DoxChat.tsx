/**
 * DOX-C3a (#139) — the real chat core, host-agnostic.
 *
 * Replaces DOX-C0's static probe: this one actually talks to `/api/chat`
 * (DOX-C2's Worker). No shell chrome and no dock frame live here — `DoxPage`
 * supplies the full-bleed shell, and phase 2's dock will supply its own panel,
 * so the same transcript renders identically in both.
 *
 * The sheets are imported here rather than added to `astro.config.mjs`'s
 * `customCss` so Vite code-splits them into this island's chunk — a page that
 * never opens the chat downloads neither.
 */
import "../../styles/gmt-ask-tailwind.css";
import "../../styles/gmt-ask.css";
import "../../styles/gmt-hive.css";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StickToBottomContext } from "use-stick-to-bottom";

import { SearchIcon } from "lucide-react";

import { referenceRoutes } from "~/generated/reference/route-manifest";
import { CHAT_STARTERS, CORPUS_SUMMARY } from "~/lib/chat-constants";
import { checkUserText } from "~/lib/chat-sanitize";
import type { BrainsInfo } from "./use-brains";
import { untilReset } from "./use-brains";
import { RETRIEVAL_PART_TYPE, type RetrievalTraceData } from "~/lib/chat-types";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "../ai-elements/conversation";
import { MessageResponse } from "../ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "../ai-elements/prompt-input";
import githubDark from "shiki/dist/themes/github-dark.mjs";
import githubLight from "shiki/dist/themes/github-light.mjs";
import { Suggestion } from "../ai-elements/suggestion";
import {
  ChatWarning,
  type ChatWarningState,
  classifyChatError,
} from "./chat-warning";
import { HiveHub } from "./hive/HiveHub";
import { HiveNode } from "./hive/HiveNode";
import { messageText, sendableHistory } from "~/lib/chat-history";
import { createLinkComponents } from "./link-components";
import { RetrievalTrace } from "./RetrievalTrace";
import { WidgetReceipt } from "./WidgetReceipt";
import { useIdleTimeout } from "./use-idle-timeout";

/** Streamdown's code plugin defaults to the theme *names* `github-light` /
 * `github-dark`, which its pinned Shiki can't resolve once bundled for the
 * browser — that failure is why DOX-C0 disabled the plugin outright and code
 * blocks have rendered unhighlighted ever since. Passing the theme *objects*
 * sidesteps the lookup entirely: they're bundled by our own build, so there is
 * nothing for Shiki to go find at runtime. Deep import rather than
 * `bundledThemes`, which is a lazy-loader map over every theme shiki ships and
 * would emit ~60 chunks to use two. */
const SHIKI_THEME: [typeof githubLight, typeof githubDark] = [
  githubLight,
  githubDark,
];

/** The tool calls in one assistant turn. Empty for every turn until DOX-C3b's
 *  tools started being offered — see worker/tools.ts. */
function widgetCallsOf(message: UIMessage): ToolUIPart[] {
  return message.parts.filter((part): part is ToolUIPart => isToolUIPart(part));
}

function retrievalTraceOf(message: UIMessage): RetrievalTraceData | undefined {
  const part = message.parts.find((p) => p.type === RETRIEVAL_PART_TYPE);
  return part && "data" in part ? (part.data as RetrievalTraceData) : undefined;
}

/** Non-OK responses carry the Worker's own `{error, retryable}` JSON, but the
 * transport throws before that body reaches `onError` — the SDK formats its own
 * message and the original payload is lost. Reading it here and attaching it to
 * `cause` is what lets the UI show the Worker's actual wording (and its
 * `retryable` flag) instead of a generic failure. */
async function chatFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.ok) return response;

  let payload: unknown;
  try {
    payload = await response.clone().json();
  } catch {
    payload = undefined;
  }

  const error = new Error(`Chat request failed with ${response.status}`, {
    cause: { status: response.status, payload },
  });
  throw error;
}

export interface DoxChatProps {
  /** Today's budget, from `/api/brains`. Null while loading or if the endpoint
   * is unreachable — the chat stays fully usable either way. */
  brains?: BrainsInfo | null;
  /** The reader's explicit brain pick, or null for "whichever has budget". */
  selectedBrainId?: string | null;
  /** Called after a question is sent, so the host can re-read the counts. */
  onUsed?: () => void;
  /** DOX-C3b — the host owns the widget rail; this is how a tool call reaches
   *  it, either automatically when one streams in or when the reader reopens a
   *  receipt. */
  onWidget?: (toolCallId: string, toolName: string, input: unknown) => void;
}

export function DoxChat({
  brains = null,
  selectedBrainId = null,
  onUsed,
  onWidget,
}: DoxChatProps = {}) {
  const [warning, setWarning] = useState<ChatWarningState | null>(null);
  /** Every URL retrieved this session. Unioned with the reference manifest to
   * decide which links are real — the manifest holds only `/reference/...`
   * paths, so guide citations would otherwise be downgraded to plain text. */
  const [retrievedUrls, setRetrievedUrls] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  /* `body` below is re-evaluated per request but the transport itself is built
     once, so it would close over the brain chosen at mount. A ref keeps the
     current pick reachable without rebuilding the transport — and rebuilding it
     mid-conversation would drop the in-flight request. */
  const brainRef = useRef<string | null>(selectedBrainId);
  brainRef.current = selectedBrainId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        /* Assembled per request rather than declared as a static `body`, because
           the history needs filtering as well as the body needing the current
           page and brain. `sendableHistory` drops assistant turns that never
           received a token — see chat-history.ts for why replaying those is
           worse than it looks. */
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages: sendableHistory(messages),
            pageContext: window.location.pathname,
            ...(brainRef.current ? { model: brainRef.current } : {}),
          },
        }),
        fetch: chatFetch,
      }),
    [],
  );

  const { messages, sendMessage, stop, status } = useChat({
    transport,
    onError: (error) => setWarning(classifyChatError(error)),
    onData: (part) => {
      if (part.type !== RETRIEVAL_PART_TYPE) return;
      const data = part.data as RetrievalTraceData;
      setRetrievedUrls((current) => {
        const next = new Set(current);
        for (const url of data.chunkUrls ?? []) next.add(url);
        return next;
      });
    },
  });

  const onStall = useCallback(() => {
    setWarning({
      message:
        "Dox stopped responding. The answer above may be incomplete — try asking again.",
      retryable: true,
    });
  }, []);

  useIdleTimeout({ status, messages, stop, onStall });

  const knownRoutes = useMemo(() => {
    const combined = new Set<string>(referenceRoutes);
    for (const url of retrievedUrls) combined.add(url);
    return combined;
  }, [retrievedUrls]);

  /* No `siteOrigin` here on purpose — `createLinkComponents` reads it lazily at
     link-render time. This memo runs during SSR, where `window` does not
     exist. */
  const linkComponents = useMemo(
    () => createLinkComponents({ knownRoutes }),
    [knownRoutes],
  );

  /** `Conversation` is `use-stick-to-bottom`; this is its published escape
   * hatch (`StickToBottomProps.contextRef`). The library re-locks on its own
   * for a reader who is already at the bottom, but not for one who scrolled up
   * to re-read an earlier answer — sending should always bring them back. */
  const conversationRef = useRef<StickToBottomContext | null>(null);

  /** One request at a time. This is the authoritative guard — the disabled
   * button and the swallowed Enter key below are the *visible* half, but a
   * suggestion pill, a stale closure, or a double-fire from a fast Enter can
   * all reach `send` without going past either of them. */
  const isBusy = status === "submitted" || status === "streaming";

  /* Out of budget — the shared pool, or this visitor's own share. Rendered as a
     sentinel state rather than an error: nothing has gone wrong, Dox has simply
     spent what a free tier gives it today. `visual-design.md`'s sentinel
     contract is explicit that "the assistant is resting until midnight" teaches
     the reader something, where a generic failure teaches them nothing. */
  const poolSpent =
    brains !== null && brains.brains.every((brain) => brain.remaining <= 0);
  const visitorSpent =
    brains !== null &&
    !brains.visitor.unlimited &&
    (brains.visitor.remaining ?? 1) <= 0;
  const outOfBudget = poolSpent || visitorSpent;

  /** Returns whether the message was actually sent. A `false` is what the
   *  composer needs to keep the reader's text in the box — see the throw in
   *  `PromptInput`'s `onSubmit` below, and the local modification it relies on
   *  in `ai-elements/prompt-input.tsx`. */
  const send = useCallback(
    (text: string): boolean => {
      if (isBusy || outOfBudget) return false;

      // Same check the Worker runs, so a reader learns *here* that a paste is
      // too long or that a message is nothing but invisible characters,
      // instead of after a round trip. The Worker still repeats it: the client
      // is a convenience, not a boundary.
      const checked = checkUserText(text);
      if (!checked.ok) {
        // An empty box is a no-op, not an error worth a banner.
        if (text.trim() !== "") {
          setWarning({ message: checked.reason, retryable: false });
        }
        return false;
      }

      setWarning(null);
      sendMessage({ text: checked.text });
      conversationRef.current?.scrollToBottom();
      // Re-read the budget after the request has had a moment to be recorded.
      // Advisory numbers, so a slightly late refresh is fine; a missing one
      // would leave a stale badge for the rest of the session.
      window.setTimeout(() => onUsed?.(), 1500);
      return true;
    },
    [isBusy, onUsed, outOfBudget, sendMessage],
  );

  /** Enter submits (PromptInputTextarea, vendored). While Dox is working that
   * would queue a second request, so it is swallowed here — the vendored
   * handler runs ours first and bails if we called `preventDefault`. Shift and
   * IME composition are left alone: those are a newline and a commit, not a
   * send, and blocking them would break both. */
  const onComposerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isBusy) return;
      if (event.key !== "Enter") return;
      if (event.shiftKey || event.nativeEvent.isComposing) return;
      event.preventDefault();
    },
    [isBusy],
  );

  /** Re-ask the last question the reader actually typed. Only reachable from a
   *  warning classified `retryable` (see chat-warning.tsx), and it goes through
   *  `send`, so the busy guard, the budget guard and the length checks all
   *  still apply — a retry is an ordinary request, not a privileged one. */
  const retryLastQuestion = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const text = messageText(lastUser);
    if (text.trim() === "") return;
    setWarning(null);
    send(text);
  }, [messages, send]);

  const openWidget = useCallback(
    (toolCallId: string, toolName: string, input: unknown) => {
      onWidget?.(toolCallId, toolName, input);
    },
    [onWidget],
  );

  /* Open the rail on its own when a tool call completes, so the reader does not
     have to click a receipt to see what they asked for. Keyed on the call id so
     re-renders during streaming do not re-open a rail the reader just closed. */
  const lastOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    const newest = messages[messages.length - 1];
    if (!newest || newest.role !== "assistant") return;
    const ready = widgetCallsOf(newest).find(
      (part) =>
        part.state === "output-available" || part.state === "input-available",
    );
    if (!ready || lastOpenedRef.current === ready.toolCallId) return;
    lastOpenedRef.current = ready.toolCallId;
    onWidget?.(ready.toolCallId, getToolName(ready), ready.input);
  }, [messages, onWidget]);

  const isEmpty = messages.length === 0;

  /** Between `sendMessage` and the first streamed token, `status` is
   * "submitted" and no assistant message exists yet — so without a placeholder
   * the page shows nothing at all for the whole round trip and reads as frozen.
   * Derived from status rather than pushed into `messages`, so it can't leak
   * into the next request's history (the same discipline as ChatWarning). */
  const isWaiting = status === "submitted";

  return (
    // Transcript + composer only. The surrounding shell (viewport height, the
    // wayfinding strip, the lattice) belongs to the host — `DoxPage` for
    // `/dox`, the dock's own panel in phase 2 — so this renders identically in
    // both without knowing which one it's in.
    <div className="gmt-ask gmt-hive-chat">
      {/* No wrapper div around `Conversation`. `StickToBottom` renders its own
          scroll element *inside* itself and gives this root `overflow-y:
          hidden` — so an outer `overflow-y: auto` box made the page scroll
          somewhere the library holds no reference to, leaving its inner
          element at scrollHeight === clientHeight and every scrollToBottom() a
          no-op. The flex sizing belongs on this element. */}
      <Conversation className="gmt-hive-scroll" contextRef={conversationRef}>
        <ConversationContent className="gmt-hive">
          {isEmpty ? (
            <div className="gmt-hive-empty">
              <HiveHub />
              <p className="gmt-hive-status">Dox // {CORPUS_SUMMARY}</p>
              {/* Name the character. A reader arriving here should learn that
                  the thing answering is called Dox — and the code treatment
                  ties the name to the crystal above it and to the same
                  treatment `@northguild/gmt` gets, so both read as identifiers
                  rather than prose. */}
              <p className="gmt-hive-prompt">
                Ask <code className="gmt-hive-name">Dox</code> about dates,
                times, and zones in <code>@northguild/gmt</code>.
              </p>
              <div className="gmt-hive-starters">
                {CHAT_STARTERS.map((starter) => (
                  <Suggestion
                    key={starter.widget}
                    className="gmt-hive-starter gmt-sonar-focus"
                    suggestion={starter.text}
                    onClick={send}
                  />
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
              const role = message.role === "user" ? "user" : "assistant";
              const trace = retrievalTraceOf(message);
              /* The stream has opened and the trace has landed, but no token
                 has arrived yet. Dox is still working, so the crystal keeps
                 turning and the card keeps its sheen — one condition driving
                 both, so the marker and the surface can never disagree about
                 whether anything is happening.
                 
                 `index === messages.length - 1` is load-bearing. An assistant
                 turn that never received any text — stopped before the first
                 token, or killed mid-stream by an error — keeps empty text
                 forever. Without the index check every one of those lit up
                 again on every subsequent question, so a single earlier failure
                 left a card apparently loading for the rest of the session.
                 Only the newest turn can be in progress. */
              const widgetCalls = widgetCallsOf(message);
              /* `widgetCalls.length === 0` is the DOX-C3b clause. A turn whose
                 only content is a tool call has `messageText() === ""` forever,
                 so without it the crystal would keep spinning under a perfectly
                 finished answer. */
              const isThinking =
                role === "assistant" &&
                status === "streaming" &&
                index === messages.length - 1 &&
                messageText(message) === "" &&
                widgetCalls.length === 0;

              return (
                <div key={message.id} className="contents">
                  <article className="gmt-hive-turn" data-role={role}>
                    <HiveNode role={role} pending={isThinking} />
                    <div
                      className="gmt-hive-card"
                      data-pending={isThinking ? "" : undefined}
                    >
                      {trace && <RetrievalTrace data={trace} />}
                      {/* The trace lands before the first token, so without
                          this the card sits visibly empty beneath it for as
                          long as the model takes to start. Same scanline as
                          the pending turn, so the two states read as one
                          continuous "working" rather than two. */}
                      {isThinking && (
                        <span
                          className="gmt-hive-scanline"
                          aria-hidden="true"
                        />
                      )}
                      {role === "assistant" ? (
                        <MessageResponse
                          className="gmt-ask-response"
                          components={linkComponents}
                          shikiTheme={SHIKI_THEME}
                          lineNumbers={false}
                        >
                          {messageText(message)}
                        </MessageResponse>
                      ) : (
                        <p className="gmt-hive-user-text">
                          {messageText(message)}
                        </p>
                      )}
                      {/* After the prose, never interleaved with it. One
                          `MessageResponse` per turn is deliberate: Gemini emits
                          text → tool-call → text, and a markdown construct that
                          straddles that boundary (an unclosed fence, a link
                          whose `]` and `(` land in different parts) renders
                          wrong across two Streamdown instances — and the link
                          hardening only ever sees what each instance parsed. */}
                      {widgetCalls.map((part) => (
                        <WidgetReceipt
                          key={part.toolCallId}
                          part={part}
                          onOpen={openWidget}
                        />
                      ))}
                    </div>
                  </article>
                </div>
              );
            })
          )}

          {isWaiting && (
            <>
              <article className="gmt-hive-turn" data-role="assistant">
                <HiveNode role="assistant" pending />
                <div className="gmt-hive-card" data-pending="">
                  <p className="gmt-hive-pending" role="status">
                    {/* Same icon the retrieval trace uses, so "searching" and
                        the trace it resolves into read as one step. */}
                    <SearchIcon aria-hidden="true" />
                    Searching corpus&#8230;
                  </p>
                  <span className="gmt-hive-scanline" aria-hidden="true" />
                </div>
              </article>
            </>
          )}

          {warning && (
            <ChatWarning state={warning} onRetry={retryLastQuestion} />
          )}
        </ConversationContent>
        <ConversationScrollButton className="gmt-hive-jump gmt-sonar-focus" />
      </Conversation>

      <div className="gmt-hive-composer">
        <div className="gmt-hive-composer-inner">
          {outOfBudget && (
            <p className="gmt-hive-exhausted" role="status">
              <span className="gmt-hive-exhausted-marker" aria-hidden="true">
                ⟨ · ⟩
              </span>
              {visitorSpent && !poolSpent
                ? `You have used your ${brains?.visitor.limit} questions for today.`
                : "Dox has used its free allowance for today."}{" "}
              Resets {untilReset(brains?.resetsAt)}.
            </p>
          )}
          <PromptInput
            onSubmit={(message, event) => {
              event.preventDefault();
              /* Throwing is PromptInput's documented signal for "this send did
                 not happen, keep the composer's contents" — it is what its two
                 "Don't clear on error - user may want to retry" branches catch.
                 A reader whose paste was refused for being too long can then
                 trim it and resend, instead of losing it. */
              if (!send(message.text ?? "")) {
                throw new Error("send refused");
              }
            }}
          >
            <PromptInputBody>
              {/* A real <textarea>: Enter submits, Shift+Enter inserts a
                  newline, and IME composition is guarded — all already handled
                  by PromptInputTextarea. Do not rebuild it. */}
              <PromptInputTextarea
                onKeyDown={onComposerKeyDown}
                disabled={outOfBudget}
                placeholder={
                  outOfBudget
                    ? "Dox is resting until the quota resets…"
                    : "Ask about @northguild/gmt…"
                }
              />
            </PromptInputBody>
            <PromptInputFooter className="gmt-hive-composer-footer">
              {brains?.visitor.unlimited && (
                <span
                  className="gmt-hive-dev-note"
                  title="Exempt from the per-visitor cap. The shared daily pool is fixed and cannot be raised on the free tier."
                >
                  dev · no personal cap
                </span>
              )}
              <PromptInputSubmit
                status={status}
                onStop={stop}
                className="gmt-hive-submit gmt-sonar-focus"
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

export default DoxChat;
