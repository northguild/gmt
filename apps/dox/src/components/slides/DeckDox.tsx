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
 *
 * This file is the chat and the frame. The rest is one module each: the slide's life
 * (`use-deck-session.ts`), the brain pick and bar (`use-deck-brain.ts`, `DeckBrainBar.tsx`), the
 * rail's widget (`ask/use-rail-widget.ts`), the question cards (`DeckQuestions.tsx`), the tools
 * slide's scripted answer (`deck-dox-tool-stream.ts`) and its scroll (`glide-to-lead.ts`).
 */
import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import {
  DoxChat,
  type ChatHost,
  type DoxChatHandle,
} from "~/components/ask/DoxChat";
import { ChatErrorBoundary } from "~/components/ask/ChatErrorBoundary";
import { RailResizer } from "~/components/ask/RailResizer";
import { WidgetRail } from "~/components/ask/WidgetRail";
import { useBrains } from "~/components/ask/use-brains";
import { useRailWidget } from "~/components/ask/use-rail-widget";
import { useResetClock } from "~/components/ask/use-reset-clock";
import type {
  createDeckSession,
  SourceState,
} from "~/lib/slides/deck-transport";
import type { DeckToolScript, FaqQuestion } from "~/lib/slides/live-data";
import type { Recording } from "~/lib/slides/replay";
import { DeckBrainBar } from "./DeckBrainBar";
import { TOOL_ID } from "./deck-dox-tool-stream";
import { DeckQuestions } from "./DeckQuestions";
import { glideToLead } from "./glide-to-lead";
import { useDeckBrain } from "./use-deck-brain";
import { useDeckSession } from "./use-deck-session";
import styles from "./deck-dox.module.css";
import "./deck-dox-chat.css";

export type DeckDoxMode = "answer" | "audience" | "tools";

interface DeckDoxProps {
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

/** The line above the composer: where the answer on screen comes from. No model writes the
 *  tools slide's answer; the page's own tool does. */
function sourceText(state: SourceState | null, mode: DeckDoxMode): string {
  if (state === null) return "";
  if (state.source === "live")
    return mode === "tools" ? "Run in this page" : "Live answer";
  if (state.source === "recorded") return state.label ?? "Recorded answer";
  return state.label ?? "Waiting for Dox";
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
  const { id: brainId, pick: brainPick } = useDeckBrain();
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
  const { railWidget, showWidget, closeWidget } = useRailWidget();

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
      <DeckBrainBar brains={brains} brainId={brainId} clock={clock} />
    </>
  );
}

export default function DeckDox(props: DeckDoxProps) {
  const { mode, demoId, pageContext, zone, tool } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const { session, source, round, run } = useDeckSession({
    mode,
    demoId,
    pageContext,
    zone,
    tool,
    rootRef,
  });

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
