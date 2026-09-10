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
import type { RetrievalTraceData } from "~/lib/chat-types";
import { Task, TaskContent, TaskItem, TaskTrigger } from "../ai-elements/task";

export function RetrievalTrace({ data }: { data: RetrievalTraceData }) {
  const { totalChunks, retrievedCount, chunkTitles, brainLabel } = data;

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
      </TaskContent>
    </Task>
  );
}
