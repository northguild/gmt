import { Temporal } from "@js-temporal/polyfill";
import { halfOpenMerge } from "../../internal";
import { isValidTimeInterval } from "./validate";
import { isObject } from "../../internal/isObject";

/**
 * Collapse a list of time intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionTime`, which is pairwise only.
 * - Half-open: an interval holds every `t` with `start <= t < end`. Overlapping intervals and
 *   touching intervals (`aEnd === bStart`) join into one run; any gap, even one unit, keeps them
 *   apart (CORE-6's `mergeIntervals`).
 * - An empty interval (`start === end`) holds nothing: it is absorbed by a run it touches or lies
 *   in, and dropped otherwise, so every returned interval is non-empty.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list.
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO PlainTime strings, or when any element has
 *   `start > end`.
 *
 * @param intervals array of `{ start, end }` records
 * @returns the minimum set of non-overlapping `{ start, end }` records, sorted by start, or `[]` on invalid input
 *
 * @example mergeIntervalsTime([{ start: "09:00:00", end: "12:00:00" }, { start: "12:00:00", end: "15:00:00" }]) // [{ start: "09:00:00", end: "15:00:00" }] (touching)
 * @example mergeIntervalsTime([{ start: "09:00:00", end: "12:00:00" }, { start: "12:00:00.000000001", end: "15:00:00" }]) // [{ start: "09:00:00", end: "12:00:00" }, { start: "12:00:00.000000001", end: "15:00:00" }] (1 ns gap)
 * @example mergeIntervalsTime([]) // []
 * @example mergeIntervalsTime([{ start: "15:00:00", end: "09:00:00" }]) // []
 */
export function mergeIntervalsTime(
  intervals: Array<{ start: string; end: string }>,
): Array<{
  /**
   * The clock time the interval begins at, as an ISO 8601 time string with no date, offset or time
   * zone.
   */
  start: string;
  /**
   * The first clock time after the interval, in the same format as `start`. It is exclusive: the
   * interval holds everything from `start` up to but not including this value. It is always later
   * than `start`.
   */
  end: string;
}> {
  try {
    if (!Array.isArray(intervals) || intervals.length === 0) {
      return [];
    }

    if (
      !intervals.every(
        (interval) =>
          isObject(interval) &&
          isValidTimeInterval(interval.start, interval.end),
      )
    ) {
      return [];
    }

    try {
      const parsed = intervals.map((interval) => ({
        start: Temporal.PlainTime.from(interval.start),
        end: Temporal.PlainTime.from(interval.end),
      }));

      const merged = halfOpenMerge(parsed, Temporal.PlainTime.compare);

      return merged.map((interval) => ({
        start: interval.start.toString(),
        end: interval.end.toString(),
      }));
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
