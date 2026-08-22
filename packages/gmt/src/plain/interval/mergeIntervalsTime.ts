import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeInterval } from "./validate";

/**
 * Collapse a list of time intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionTime`, which is pairwise only.
 * - Intervals are merged when they overlap or share an endpoint exactly (adjacent intervals
 *   ARE merged).
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list.
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO PlainTime strings, or when any element has
 *   `start > end`.
 *
 * @param intervals array of `{ start, end }` records
 * @returns the minimum set of non-overlapping `{ start, end }` records, sorted by start, or `[]` on invalid input
 *
 * @example mergeIntervalsTime([{ start: "09:00:00", end: "12:00:00" }, { start: "11:00:00", end: "15:00:00" }]) // [{ start: "09:00:00", end: "15:00:00" }]
 * @example mergeIntervalsTime([]) // []
 * @example mergeIntervalsTime([{ start: "15:00:00", end: "09:00:00" }]) // []
 */
export function mergeIntervalsTime(
  intervals: Array<{ start: string; end: string }>,
): Array<{ start: string; end: string }> {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return [];
  }

  if (
    !intervals.every(
      (interval) =>
        interval &&
        typeof interval === "object" &&
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

    parsed.sort((a, b) => Temporal.PlainTime.compare(a.start, b.start));

    const merged: Array<{
      start: Temporal.PlainTime;
      end: Temporal.PlainTime;
    }> = [];

    for (const interval of parsed) {
      const last = merged[merged.length - 1];

      if (last && Temporal.PlainTime.compare(interval.start, last.end) <= 0) {
        if (Temporal.PlainTime.compare(interval.end, last.end) > 0) {
          last.end = interval.end;
        }
      } else {
        merged.push({ start: interval.start, end: interval.end });
      }
    }

    return merged.map((interval) => ({
      start: interval.start.toString(),
      end: interval.end.toString(),
    }));
  } catch {
    return [];
  }
}
