import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeInterval } from "./validate";

/**
 * Collapse a list of datetime intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionDateTime`, which is pairwise only.
 * - Intervals are merged when they overlap or share an endpoint exactly (adjacent intervals
 *   ARE merged).
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list.
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO PlainDateTime strings, or when any element has
 *   `start > end`.
 *
 * @param intervals array of `{ start, end }` records
 * @returns the minimum set of non-overlapping `{ start, end }` records, sorted by start, or `[]` on invalid input
 *
 * @example mergeIntervalsDateTime([{ start: "2024-01-01T00:00:00", end: "2024-01-10T00:00:00" }, { start: "2024-01-05T00:00:00", end: "2024-01-15T00:00:00" }]) // [{ start: "2024-01-01T00:00:00", end: "2024-01-15T00:00:00" }]
 * @example mergeIntervalsDateTime([]) // []
 * @example mergeIntervalsDateTime([{ start: "2024-01-10T00:00:00", end: "2024-01-01T00:00:00" }]) // []
 */
export function mergeIntervalsDateTime(
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
        isValidDateTimeInterval(interval.start, interval.end),
    )
  ) {
    return [];
  }

  try {
    const parsed = intervals.map((interval) => ({
      start: Temporal.PlainDateTime.from(interval.start),
      end: Temporal.PlainDateTime.from(interval.end),
    }));

    parsed.sort((a, b) => Temporal.PlainDateTime.compare(a.start, b.start));

    const merged: Array<{
      start: Temporal.PlainDateTime;
      end: Temporal.PlainDateTime;
    }> = [];

    for (const interval of parsed) {
      const last = merged[merged.length - 1];

      if (
        last &&
        Temporal.PlainDateTime.compare(interval.start, last.end) <= 0
      ) {
        if (Temporal.PlainDateTime.compare(interval.end, last.end) > 0) {
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
