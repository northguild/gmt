import { canonicalInstantIntervals } from "../../internal";
import { mergeIntervals } from "../../interval/calculate";
import { isValidUtcInterval } from "./validate";

/**
 * Collapse a list of UTC intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionUtc`, which is pairwise only.
 * - Half-open: an interval holds every `t` with `start <= t < end`. Overlapping intervals and
 *   touching intervals (`aEnd === bStart`) join into one run; any gap, even one unit, keeps them
 *   apart (CORE-6's `mergeIntervals`).
 * - An empty interval (`start === end`) holds nothing: it is absorbed by a run it touches or lies
 *   in, and dropped otherwise, so every returned interval is non-empty.
 * - Delegates to CORE-6's `mergeIntervals` once every element passes the UTC-string gate, and
 *   re-serialises the runs to canonical `Z` strings.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list.
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO UTC datetime strings, or when any element has
 *   `start > end` or a leap-second string.
 *
 * @param intervals array of `{ start, end }` records
 * @returns the minimum set of non-overlapping `{ start, end }` records, sorted by start, or `[]` on invalid input
 *
 * @example mergeIntervalsUtc([{ start: "2024-01-01T00:00:00Z", end: "2024-01-10T00:00:00Z" }, { start: "2024-01-05T00:00:00Z", end: "2024-01-15T00:00:00Z" }]) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-15T00:00:00Z" }]
 * @example mergeIntervalsUtc([{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }] (touching)
 * @example mergeIntervalsUtc([{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T09:00:00Z" }]) // [] (empty interval)
 * @example mergeIntervalsUtc([]) // []
 */
export function mergeIntervalsUtc(
  intervals: Array<{ start: string; end: string }>,
): Array<{ start: string; end: string }> {
  try {
    if (!Array.isArray(intervals) || intervals.length === 0) {
      return [];
    }

    if (
      !intervals.every(
        (interval) =>
          interval &&
          typeof interval === "object" &&
          typeof interval.start === "string" &&
          typeof interval.end === "string" &&
          isValidUtcInterval(interval.start, interval.end),
      )
    ) {
      return [];
    }

    return canonicalInstantIntervals(mergeIntervals(intervals)) ?? [];
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
