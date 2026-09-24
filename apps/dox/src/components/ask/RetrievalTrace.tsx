/**
 * DOX-C3a (#139) — the visible retrieval trace.
 *
 * Makes grounding legible instead of asserted: how much corpus was searched,
 * how much cleared the relevance threshold, and which chunks those were. It
 * also exercises DOX-C1's honest-refusal path in the open — a question that
 * retrieved nothing *looks* like it retrieved nothing, right above an answer
 * that declines to guess.
 *
 * Collapsed by default, unlike the vendored `Task`'s own `defaultOpen`: a
 * reader's first instinct should be the answer, not the retrieval log.
 */
import type {
  BrainAttemptTrace,
  RetrievalTimings,
  RetrievalTraceData,
} from "~/lib/chat-types";
import { BRAINS } from "~/lib/chat-constants";
import { Task, TaskContent, TaskItem, TaskTrigger } from "../ai-elements/task";

/** "0.4 s" above a second, "320 ms" below it. */
export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

function brainLabelFor(id: string): string {
  return BRAINS.find((brain) => brain.id === id)?.label ?? id;
}

/** One line per stage, in pipeline order, so a reader can see which stage a
 * slow answer spent its time in. */
export function describeTimings(timings: RetrievalTimings): string {
  const stages: [string, number | undefined][] = [
    ["ledger", timings.usage],
    ["corpus", timings.corpus],
    ["search", timings.search],
    ["prompt", timings.prompt],
    ["brains", timings.brains],
    ["first token", timings.firstToken],
    ["total", timings.total],
  ];
  return stages
    .filter((entry): entry is [string, number] => entry[1] !== undefined)
    .map(([name, ms]) => `${name} ${formatMs(ms)}`)
    .join(" · ");
}

/** "3.8 Flash spent 2.1 s → 3.7 Flash answered 1.8 s". */
export function describeAttempts(attempts: BrainAttemptTrace[]): string {
  return attempts
    .map(
      (attempt) =>
        `${brainLabelFor(attempt.brainId)} ${attempt.outcome} ${formatMs(attempt.ms)}`,
    )
    .join(" → ");
}

export function RetrievalTrace({ data }: { data: RetrievalTraceData }) {
  const {
    totalChunks,
    retrievedCount,
    chunkTitles,
    brainLabel,
    timings,
    attempts,
    toolCalled,
  } = data;

  /* Naming the brain matters more than it looks: Dox switches models silently
     when one runs out of its daily allowance, and two answers in the same
     transcript can therefore differ in voice or depth. Without this the reader
     has no way to tell that apart from Dox being erratic. */
  const summary = brainLabel
    ? `Searched ${totalChunks} chunks → ${retrievedCount} matched · ${brainLabel}`
    : `Searched ${totalChunks} chunks → ${retrievedCount} matched`;

  return (
    <Task defaultOpen={false} className="gmt-hive-trace">
      <TaskTrigger title={summary} />
      <TaskContent>
        {chunkTitles.length === 0 ? (
          <TaskItem>Nothing in the corpus matched this question.</TaskItem>
        ) : (
          chunkTitles.map((title) => <TaskItem key={title}>{title}</TaskItem>)
        )}
        {/* Where the time went. The first write carries the pre-stream stages;
            the finishing write adds first token, total and the tool. */}
        {timings && (
          <TaskItem className="gmt-hive-trace-timing" data-role="timings">
            {describeTimings(timings)}
          </TaskItem>
        )}
        {attempts && attempts.length > 0 && (
          <TaskItem className="gmt-hive-trace-timing" data-role="attempts">
            {describeAttempts(attempts)}
          </TaskItem>
        )}
        {toolCalled !== undefined && (
          <TaskItem className="gmt-hive-trace-timing" data-role="tool">
            {toolCalled ? `Widget: ${toolCalled}` : "No widget called."}
          </TaskItem>
        )}
      </TaskContent>
    </Task>
  );
}
