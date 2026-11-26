import { dateTimeIntervalOf } from "../../internal/intervalChecks";
import { Temporal } from "../../internal/temporal";
import { halfOpenMerge } from "../../internal";
import { isObject } from "../../internal/isObject";

/**
 * Collapse a list of datetime intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionDateTime`, which is pairwise only.
 * - Half-open: an interval holds every `t` with `start <= t < end`. Overlapping intervals and
 *   touching intervals (`aEnd === bStart`) join into one run; any gap, even one unit, keeps them
 *   apart (CORE-6's `mergeIntervals`).
 * - An empty interval (`start === end`) holds nothing: it is absorbed by a run it touches or lies
 *   in, and dropped otherwise, so every returned interval is non-empty.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list.
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO PlainDateTime strings, or when any element has
 *   `start > end`.
 *
 * @param intervals array of `{ start, end }` records
 * @returns the minimum set of non-overlapping `{ start, end }` records, sorted by start, or `[]` on invalid input
 *
 * @example mergeIntervalsDateTime([{ start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" }, { start: "2024-01-10T00:00:00", end: "2024-01-15T00:00:00" }]) // [{ start: "2024-01-01T00:00:00", end: "2024-01-15T00:00:00" }] (touching)
 * @example mergeIntervalsDateTime([{ start: "2024-01-01T00:00:00", end: "2024-01-01T00:00:00" }]) // [] (empty interval)
 * @example mergeIntervalsDateTime([]) // []
 * @example mergeIntervalsDateTime([{ start: "2024-01-10T00:00:00", end: "2024-01-01T00:00:00" }]) // []
 */
export function mergeIntervalsDateTime(
  intervals: Array<{ start: string; end: string }>,
): Array<{
  /**
   * The date-time the interval begins at, as an ISO 8601 date-time string with no offset or time
   * zone.
   */
  start: string;
  /**
   * The first date-time after the interval, in the same format as `start`. It is exclusive: the
   * interval holds everything from `start` up to but not including this value. It is always later
   * than `start`.
   */
  end: string;
}> {
  try {
    if (!Array.isArray(intervals) || intervals.length === 0) {
      return [];
    }

    const parsed: Array<{
      start: Temporal.PlainDateTime;
      end: Temporal.PlainDateTime;
    }> = [];
    for (const interval of intervals) {
      const bounds = isObject(interval)
        ? dateTimeIntervalOf(interval.start, interval.end)
        : null;
      if (bounds === null) {
        return [];
      }
      parsed.push({ start: bounds[0], end: bounds[1] });
    }

    try {
      const merged = halfOpenMerge(parsed, Temporal.PlainDateTime.compare);

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
