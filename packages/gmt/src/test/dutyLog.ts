import { Temporal } from "@js-temporal/polyfill";
import type { DutyEntry } from "../types";

/** One step of a duty sequence: a status (or `null` for an unlogged gap) and its length. */
export type DutyStep = readonly [status: string | null, length: string];

/**
 * A duty log laid end to end from `start`, each step as long as its ISO 8601 duration, so a
 * fixture reads as the shift pattern it is: `[["off", "PT10H"], ["driving", "PT11H"]]`.
 *
 * Built with Temporal alone, never with GMT, so a fixture cannot share a bug with the code under
 * test. Bounds are UTC instants ending in "Z". A `null` status leaves its length unlogged.
 *
 * @param start ISO 8601 instant string the first step starts at
 * @param steps the statuses and their lengths, in order
 * @returns the log
 */
export function dutySequence(
  start: string,
  steps: readonly DutyStep[],
): DutyEntry[] {
  const log: DutyEntry[] = [];
  let cursor = Temporal.Instant.from(start);

  for (const [status, length] of steps) {
    const next = cursor.add(Temporal.Duration.from(length));

    if (status !== null) {
      log.push({ status, start: cursor.toString(), end: next.toString() });
    }

    cursor = next;
  }

  return log;
}

/**
 * The instant a duty sequence reaches after its steps, for an `at` placed exactly at its end.
 *
 * @param start ISO 8601 instant string the sequence starts at
 * @param lengths the steps' ISO 8601 durations
 * @returns the UTC instant string
 */
export function after(start: string, ...lengths: string[]): string {
  return lengths
    .reduce(
      (cursor, length) => cursor.add(Temporal.Duration.from(length)),
      Temporal.Instant.from(start),
    )
    .toString();
}
