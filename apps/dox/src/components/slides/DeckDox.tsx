/**
 * The deck's live Dox: the real chat (`DoxChat`) and widget rail (`WidgetRail`), sized to fit a
 * slide, in place of a look-alike. Three slides use it, by `mode`:
 *
 *  - `answer` (`ask-dox`): one ready question, the running one, answered live with its recording
 *    as the fallback, and the composer for any other.
 *  - `audience` (the questions part): three FAQ pills that play recordings with no network, and
 *    the composer, whose question goes live.
 *  - `tools` (`page-tools`): no composer; Moving Feasts' page tool finds both 2027 Easters in
 *    this page when the slide's build is reached, and the receipt and the month grids appear as
 *    they do on /dox.
 *
 * The demo's rules (8 s budget, recording fallback, abort on leave) are the transport's
 * (`lib/slides/deck-transport.ts`); this file is layout, the question pills and the slide's life:
 * leaving the slide aborts everything and starts the chat afresh, so nothing is left running.
 */
import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { UIMessageChunk } from "ai";
import { DoxChat, type DoxChatHandle } from "~/components/ask/DoxChat";
import { ChatErrorBoundary } from "~/components/ask/ChatErrorBoundary";
import { RailResizer } from "~/components/ask/RailResizer";
import { WidgetRail, type RailWidget } from "~/components/ask/WidgetRail";
import { useBrains } from "~/components/ask/use-brains";
import { isSameWidget, resolveWidget } from "~/components/ask/widget-registry";
import { isActive, onDeckState } from "~/lib/slides/deck-state";
import {
  announceDemo,
  createDeckSession,
  type SourceState,
} from "~/lib/slides/deck-transport";
import type { FaqQuestion } from "~/lib/slides/live-demos";
import type { Recording } from "~/lib/slides/replay";
import styles from "./deck-dox.module.css";

export type DeckDoxMode = "answer" | "audience" | "tools";

export interface DeckDoxProps {
  mode: DeckDoxMode;
  /** The demo's id, as the presenter's Live or Recorded line names it. */
  demoId: string;
  /** The ready questions, each with the id of its recording. */
  questions: readonly FaqQuestion[];
  /** The recordings that exist, by id; a question without one says so when asked. */
  recordings: readonly Recording[];
}

/** The tools slide's one question. */
const TOOL_QUESTION = "When is Easter in 2027? Ask this page.";

const TOOL_ID = "call-1";

/** The page-tool answer as chunks: the call, the two Easters, then the widget call, which opens
 *  the month grids for the call's year. */
function toolStream(signal: AbortSignal): ReadableStream<UIMessageChunk> {
  return new ReadableStream<UIMessageChunk>({
    async start(out) {
      try {
        const { pageToolRequest, runPageToolCall } =
          await import("~/lib/slides/page-tool-call");
        const request = pageToolRequest();
        out.enqueue({ type: "start" });
        out.enqueue({ type: "text-start", id: "call" });
        out.enqueue({
          type: "text-delta",
          id: "call",
          delta: `Calling \`${request.name}\` on this page.\n`,
        });
        out.enqueue({ type: "text-end", id: "call" });
        const { text } = await runPageToolCall(signal);
        if (signal.aborted) return out.close();
        out.enqueue({ type: "text-start", id: "answer" });
        out.enqueue({
          type: "text-delta",
          id: "answer",
          delta: text,
        });
        out.enqueue({ type: "text-end", id: "answer" });
        out.enqueue({
          type: "tool-input-available",
          toolCallId: TOOL_ID,
          toolName: "showMovingFeasts",
          input: request.arguments,
        });
        out.enqueue({ type: "finish" });
        out.close();
      } catch (failure) {
        if (signal.aborted) out.close();
        else out.error(failure);
      }
    },
  });
}

/** The line above the composer: where the answer on screen comes from. No model writes the
 *  tools slide's answer; the page's own tool does. */
function sourceText(state: SourceState | null, mode: DeckDoxMode): string {
  if (state === null) return "";
  if (state.source === "live")
    return mode === "tools" ? "Run in this page" : "Live answer";
  if (state.source === "recorded") return state.label ?? "Recorded answer";
  return state.label ?? "Waiting for Dox";
}

interface QuestionsProps {
  heading: string;
  items: readonly { id: string; text: string }[];
  onAsk: (id: string) => void;
}

/** The rail's idle content: the slide's ready questions, as the examples panel's own cards. */
function DeckQuestions({ heading, items, onAsk }: QuestionsProps) {
  const headingId = useId();
  return (
    <div className="gmt-hive-examples not-content">
      <div className="gmt-hive-artifact-header gmt-hive-examples-header">
        <h2 className="gmt-hive-artifact-title" id={headingId}>
          {heading}
        </h2>
      </div>
      <div className="gmt-hive-examples-body">
        <ul className="gmt-hive-examples-list" aria-labelledby={headingId}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="gmt-hive-example gmt-sonar-focus"
                data-cue=""
                onClick={() => onAsk(item.id)}
              >
                <span className="gmt-hive-example-text">{item.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Chat(
  props: DeckDoxProps & {
    session: ReturnType<typeof createDeckSession>;
    source: SourceState | null;
    run: number;
    withBrains: boolean;
  },
) {
  const { mode, session, source, questions, recordings, withBrains } = props;
  const brains = useBrainsIf(withBrains);
  const chatRef = useRef<DoxChatHandle>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const railId = useId();
  const focusTitleRef = useRef(false);
  const [railWidget, setRailWidget] = useState<RailWidget | null>(null);
  const railWidgetRef = useRef<RailWidget | null>(null);
  railWidgetRef.current = railWidget;

  /* The same dispatch /dox's page makes: an unknown tool or a failed schema opens nothing. */
  const showWidget = useCallback(
    (toolCallId: string, toolName: string, input: unknown) => {
      const resolved = resolveWidget(toolName, input);
      if (!resolved.ok) return;
      if (isSameWidget(railWidgetRef.current, resolved.entry, resolved.args))
        return;
      startTransition(() => {
        setRailWidget({
          toolCallId,
          toolName,
          entry: resolved.entry,
          args: resolved.args,
        });
      });
    },
    [],
  );
  const closeWidget = useCallback(
    () => startTransition(() => setRailWidget(null)),
    [],
  );

  const ask = useCallback(
    (id: string) => {
      const item =
        mode === "tools"
          ? { id: TOOL_ID, text: TOOL_QUESTION }
          : questions.find((q) => q.id === id);
      if (!item) return;
      const text = "question" in item ? item.question : item.text;
      const recording = recordings.find((r) => r.id === item.id) ?? null;
      session.plan({ recording, recordedOnly: mode === "audience" });
      if (chatRef.current?.send(text) !== true) session.plan(null);
    },
    [mode, questions, recordings, session],
  );

  /* The tools slide runs its one call when the slide's build is reached. */
  const { run } = props;
  useEffect(() => {
    if (mode === "tools" && run > 0) ask(TOOL_ID);
  }, [mode, run, ask]);

  /* The tools slide's answer is the widget's lead (`data-rail-lead`, Moving Feasts' Easter
     plates), not its controls: once the widget has drawn, the rail glides down to it. */
  useEffect(() => {
    const host = bodyRef.current;
    if (mode !== "tools" || railWidget === null || !host) return;
    return glideToLead(host);
  }, [mode, railWidget]);

  const items = useMemo(
    () =>
      mode === "tools"
        ? [{ id: TOOL_ID, text: TOOL_QUESTION }]
        : questions.map((q) => ({ id: q.id, text: q.question })),
    [mode, questions],
  );

  const heading =
    mode === "audience"
      ? "Ready questions"
      : mode === "tools"
        ? "Page tool"
        : "Question";

  return (
    <div className={`gmt-hive-body ${styles["body"]}`} ref={bodyRef}>
      <ChatErrorBoundary label="transcript">
        <DoxChat
          ref={chatRef}
          brains={brains.info}
          onUsed={brains.refresh}
          onUsage={brains.apply}
          onWidget={showWidget}
          createTransport={session.transport}
          typing={mode !== "tools"}
          modelAnswers={mode !== "tools"}
          compact
          aboveComposer={
            <output className={styles["source"]} data-slot="source">
              {sourceText(source, mode)}
            </output>
          }
        />
      </ChatErrorBoundary>
      {/* /dox/'s own handle. The deck opens the rail at half the frame and keeps the width to
          this showing: a drag here never changes the width /dox/ remembers. */}
      <RailResizer
        railId={railId}
        container={bodyRef}
        remember={false}
        className={styles["resizer"]}
      />
      <ChatErrorBoundary label="widget rail">
        <WidgetRail
          widget={railWidget}
          onClose={closeWidget}
          onPick={() => {}}
          railId={railId}
          className={styles["rail"]}
          focusTitleRef={focusTitleRef}
          idle={{
            label: heading,
            content: (
              <DeckQuestions heading={heading} items={items} onAsk={ask} />
            ),
          }}
        />
      </ChatErrorBoundary>
    </div>
  );
}

const NO_BRAINS = {
  info: null,
  refresh: () => {},
  apply: () => {},
};

/** The brains budget only where the chat goes live; the tools slide makes no request. */
/** How long the rail's body must hold its size before the glide starts. */
const SETTLE_MS = 200;

/**
 * Scrolls the rail's body so its widget's `[data-rail-lead]` sits at the top, smoothly unless the
 * reader asked for reduced motion. The widget draws after the rail opens and its sections open
 * with an animation, so this waits until the lead is there and the body has held its size for
 * `SETTLE_MS`: a scroll before that stops short, and a smooth one is cut off by the growth under
 * it. It scrolls once. Returns the cleanup that stops waiting.
 */
function glideToLead(host: HTMLElement): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const glide = (): void => {
    const scroller = host.querySelector<HTMLElement>(".gmt-hive-artifact-body");
    const lead = scroller?.querySelector<HTMLElement>("[data-rail-lead]");
    if (!scroller || !lead) return;
    const top =
      scroller.scrollTop +
      lead.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top;
    if (scroller.scrollHeight - scroller.clientHeight < top) return;
    stop();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ top, behavior: still ? "instant" : "smooth" });
  };
  const check = (): void => {
    // The body's height comes from its children, which grow as the widget draws.
    const scroller = host.querySelector<HTMLElement>(".gmt-hive-artifact-body");
    if (scroller) for (const child of scroller.children) sizes.observe(child);
    clearTimeout(timer);
    timer = setTimeout(glide, SETTLE_MS);
  };
  const watch = new MutationObserver(check);
  const sizes = new ResizeObserver(check);
  const stop = (): void => {
    watch.disconnect();
    sizes.disconnect();
    clearTimeout(timer);
  };
  watch.observe(host, { childList: true, subtree: true });
  check();
  return stop;
}

function useBrainsIf(enabled: boolean) {
  const live = useBrains();
  return enabled ? live : NO_BRAINS;
}

export default function DeckDox(props: DeckDoxProps) {
  const { mode, demoId } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<SourceState | null>(null);
  /* Bumped on leaving the slide: a new session and a fresh chat, nothing left running. */
  const [round, setRound] = useState(0);
  /* Bumped each time the slide (or the build holding the chat) is reached while a round is idle. */
  const [run, setRun] = useState(0);
  const deckRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef(false);

  const session = useMemo(
    () =>
      createDeckSession({
        onSource: (state) => {
          setSource(state);
          const deck = deckRef.current;
          if (deck && activeRef.current)
            announceDemo(
              deck,
              state ? { id: demoId, source: state.source } : null,
            );
        },
        ...(mode === "tools" ? { local: toolStream } : {}),
      }),
    // A new round is a new session; the demo and its mode never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round],
  );

  useEffect(() => {
    const root = rootRef.current;
    const deck = root?.closest<HTMLElement>("[data-deck-root]") ?? null;
    deckRef.current = deck;
    if (!root || !deck) return;
    const life = new AbortController();
    onDeckState(deck, life.signal, (state) => {
      const now = isActive(root, state);
      if (now === activeRef.current) return;
      activeRef.current = now;
      if (now) {
        if (mode === "tools") setRun((n) => n + 1);
        return;
      }
      session.abort();
      announceDemo(deck, null);
      setSource(null);
      setRun(0);
      setRound((n) => n + 1);
    });
    const leave = (): void => session.abort();
    addEventListener("pagehide", leave);
    return () => {
      life.abort();
      removeEventListener("pagehide", leave);
      session.abort();
      activeRef.current = false;
    };
  }, [session, mode]);

  return (
    <div
      ref={rootRef}
      className={`gmt-ask ${styles["frame"]}`}
      data-mode={mode}
      data-demo-id={demoId}
    >
      <Chat
        key={round}
        {...props}
        session={session}
        source={source}
        run={run}
        withBrains={mode !== "tools"}
      />
    </div>
  );
}
