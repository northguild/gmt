import {
  coalesceIntervalNanoseconds,
  formatHourDuration,
  parseIntervalNanosecondsList,
} from "../../internal";
import type { Interval } from "../../types";

/**
 * Return the time covered by a list of half-open intervals, as an exact ISO 8601 duration.
 *
 * - Covered time is the length of the union: overlapping time counts once, touching intervals
 *   add up, empty intervals add nothing.
 * - Hours are the largest unit, exactly as `Temporal.Instant.prototype.until` with
 *   `largestUnit: "hour"` renders it — an instant has no calendar, so there are no days.
 *   `PT49H30M`, not `P2DT1H30M`.
 * - Exact to the nanosecond at any size, including past 2^53 nanoseconds (about 104 days) and
 *   across the whole representable instant range (`PT4800000000H`).
 * - Measures elapsed time, never wall-clock distance: a New York day across spring-forward is
 *   `PT23H`.
 * - `[]` returns `"PT0S"` — no time covered, not invalid input.
 * - Returns `""` when `intervals` is not an array or any element is not a valid `Interval`.
 *
 * @param intervals array of `{ start, end }` records of ISO 8601 instant strings
 * @returns ISO 8601 duration string of the covered time, or "" on invalid input
 *
 * @example sumIntervals([{ start: "2024-01-01T00:00:00Z", end: "2024-01-03T01:30:00Z" }]) // "PT49H30M"
 * @example sumIntervals([{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T13:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" }]) // "PT8H" — overlap counted once
 * @example sumIntervals([{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:01.5Z" }]) // "PT1.5S"
 * @example sumIntervals([]) // "PT0S"
 * @example sumIntervals([{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }]) // ""
 */
export function sumIntervals(intervals: Interval[]): string {
  try {
    const records = parseIntervalNanosecondsList(intervals);

    if (records === null) {
      return "";
    }

    const total = coalesceIntervalNanoseconds(records).reduce(
      (sum, run) => sum + (run.end - run.start),
      0n,
    );

    return formatHourDuration(total);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
