/**
 * The deck's live Dox: the real chat (`DoxChat`) and widget rail (`WidgetRail`), sized to fit a
 * slide, in place of a look-alike. A slide uses it in one of three `mode`s:
 *
 *  - `answer`: one ready question, the running one, answered live with its recording
 *    as the fallback, and the composer for any other.
 *  - `audience` (the questions part): three FAQ pills that play recordings with no network, and
 *    the composer, whose question goes live.
 *  - `tools`: no composer; Moving Feasts' page tool finds both Easters of the deck's year in
 *    this page when the slide's build is reached, and the receipt and the month grids appear as
 *    they do on /dox.
 *
 * The demo's rules (8 s budget, recording fallback, abort on leave) are the transport's
 * (`lib/slides/deck-transport.ts`); this file is layout, the question pills and the slide's life:
 * leaving the slide aborts everything and starts the chat afresh, so nothing is left running.
 *
 * Every mode ends in the brain bar: the brain the live questions go to, the questions left today
 * and when they come back, so the presenter sees on any Dox slide whether to change brains. The
 * pick is the deck's one (`lib/slides/deck-brain.ts`), kept across slides and fresh chats. When
 * the counts cannot be read the bar says so, where /dox leaves the badge out.
 */
import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { UIMessageChunk } from "ai";
import {
  DoxChat,
  type ChatHost,
  type DoxChatHandle,
} from "~/components/ask/DoxChat";
import { ChatErrorBoundary } from "~/components/ask/ChatErrorBoundary";
import { RailResizer } from "~/components/ask/RailResizer";
import { WidgetRail, type RailWidget } from "~/components/ask/WidgetRail";
import { BrainSelector } from "~/components/ask/BrainSelector";
import { ResetClock } from "~/components/ask/ResetClock";
import { useBrains } from "~/components/ask/use-brains";
import { useResetClock } from "~/components/ask/use-reset-clock";
import {
  getDeckBrain,
  setDeckBrain,
  subscribeDeckBrain,
} from "~/lib/slides/deck-brain";
import { isSameWidget, resolveWidget } from "~/components/ask/widget-registry";
import { isActive, onDeckState } from "~/lib/slides/deck-state";
import {
  announceDemo,
  createDeckSession,
  type SourceState,
} from "~/lib/slides/deck-transport";
import type { DeckToolScript, FaqQuestion } from "~/lib/slides/live-data";
import { prefersReducedMotion } from "~/lib/reduced-motion";
import type { Recording } from "~/lib/slides/replay";
import styles from "./deck-dox.module.css";
import "./deck-dox-chat.css";

export type DeckDoxMode = "answer" | "audience" | "tools";

export interface DeckDoxProps {
  mode: DeckDoxMode;
  /** The demo's id, as the presenter's Live or Recorded line names it. */
  demoId: string;
  /** The ready questions, each with the id of its recording. */
  questions: readonly FaqQuestion[];
  /** The recordings that exist, by id; a question without one says so when asked. */
  recordings: readonly Recording[];
  /** The page the Worker is told a question comes from (`DeckLiveData.pageContext`). */
  pageContext: string;
  /** The deck's venue zone (`DeckEntry.zone`): a recording's date is read in it. */
  zone: string;
  /** The `tools` mode's scripted call: its question and the year the tool is called for. */
  tool?: DeckToolScript;
}

const TOOL_ID = "call-1";

/** The page-tool answer as chunks: the call, the two Easters, then the widget call, which opens
 *  the month grids for the call's year. */
function toolStream(
  year: number,
  signal: AbortSignal,
): ReadableStream<UIMessageChunk> {
  return new ReadableStream<UIMessageChunk>({
    async start(out) {
      try {
        const { pageToolRequest, runPageToolCall } =
          await import("~/lib/slides/page-tool-call");
        const request = pageToolRequest(year);
        out.enqueue({ type: "start" });
        out.enqueue({ type: "text-start", id: "call" });
        out.enqueue({
          type: "text-delta",
          id: "call",
          delta: `Calling \`${request.name}\` on this page.\n`,
        });
        out.enqueue({ type: "text-end", id: "call" });
        const { text, widget } = await runPageToolCall(year, signal);
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
          toolName: widget.toolName,
          input: widget.input,
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
  },
) {
  const { mode, session, source, questions, recordings, tool } = props;
  const brains = useBrains();
  const clock = useResetClock();
  const brainId = useSyncExternalStore(
    subscribeDeckBrain,
    getDeckBrain,
    () => null,
  );
  const brainPick = useMemo(
    () => ({ id: brainId, onSelect: setDeckBrain }),
    [brainId],
  );
  const host = useMemo<ChatHost>(
    () => ({
      createTransport: session.transport,
      brainPick,
      brainControls: false,
      typing: mode !== "tools",
      modelAnswers: mode !== "tools",
    }),
    [session, brainPick, mode],
  );
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
          ? tool && { id: TOOL_ID, text: tool.question }
          : questions.find((q) => q.id === id);
      if (!item) return;
      const text = "question" in item ? item.question : item.text;
      const recording = recordings.find((r) => r.id === item.id) ?? null;
      session.plan({ recording, recordedOnly: mode === "audience" });
      if (chatRef.current?.send(text) !== true) session.plan(null);
    },
    [mode, questions, recordings, session, tool],
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
        ? tool
          ? [{ id: TOOL_ID, text: tool.question }]
          : []
        : questions.map((q) => ({ id: q.id, text: q.question })),
    [mode, questions, tool],
  );

  const heading =
    mode === "audience"
      ? "Ready questions"
      : mode === "tools"
        ? "Page tool"
        : "Question";

  return (
    <>
      <div className={`gmt-hive-body ${styles["body"]}`} ref={bodyRef}>
        <ChatErrorBoundary label="transcript">
          <DoxChat
            ref={chatRef}
            brains={brains.info}
            onUsed={brains.refresh}
            onUsage={brains.apply}
            onWidget={showWidget}
            host={host}
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
      <fieldset
        className={`gmt-hive-controls not-content ${styles["brains"]}`}
        aria-label="Dox brain"
        data-slot="brains"
      >
        {brains.status === "ready" ? (
          <>
            <ResetClock
              info={brains.info}
              selectedBrainId={brainId}
              clock={clock}
            />
            <BrainSelector
              info={brains.info}
              selectedId={brainId}
              onSelect={setDeckBrain}
              clock={clock}
            />
          </>
        ) : (
          <p className={styles["brainsNote"]}>
            {brains.status === "loading"
              ? "Reading Dox's brains…"
              : "Dox's brains did not answer: questions left unknown, recorded answers still play."}
          </p>
        )}
      </fieldset>
    </>
  );
}

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
    scroller.scrollTo({
      top,
      behavior: prefersReducedMotion() ? "instant" : "smooth",
    });
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

export default function DeckDox(props: DeckDoxProps) {
  const { mode, demoId, pageContext, zone, tool } = props;
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
        pageContext,
        zone,
        ...(mode === "tools" && tool
          ? { local: (signal: AbortSignal) => toolStream(tool.year, signal) }
          : {}),
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
      data-deck-dox=""
      data-mode={mode}
      data-demo-id={demoId}
    >
      <Chat
        key={round}
        {...props}
        session={session}
        source={source}
        run={run}
      />
    </div>
  );
}
