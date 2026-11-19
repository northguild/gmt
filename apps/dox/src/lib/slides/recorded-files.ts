/**
 * The recordings the deck's Dox slides play, read at build time from
 * `src/slides/give-me-temporal/recorded/*.json`. A recording that is missing is left out, and the
 * slide says "Recording to come" when its question is asked; one that does not parse is left out
 * too (`parseRecording`). They go to the island as props.
 */
import { parseRecording, type Recording } from "./replay";

const files = import.meta.glob<unknown>(
  "/src/slides/give-me-temporal/recorded/*.json",
  { eager: true, import: "default" },
);

/** The recordings for the given ids, in file order. */
export function recordingsFor(ids: readonly string[]): Recording[] {
  const out: Recording[] = [];
  for (const value of Object.values(files)) {
    const recording = parseRecording(value);
    if (recording && ids.includes(recording.id)) out.push(recording);
  }
  return out;
}
