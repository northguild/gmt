import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isValidUtcInterval } from "./validate";

/**
 * Collapse a list of UTC intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionUtc`, which is pairwise only.
 * - Intervals are merged when they overlap or share an instant exactly (adjacent intervals
 *   ARE merged).
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
 * @example mergeIntervalsUtc([]) // []
 */
export function mergeIntervalsUtc(
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
        typeof interval.start === "string" &&
        typeof interval.end === "string" &&
        !isLeapSecond(interval.start) &&
        !isLeapSecond(interval.end) &&
        isValidUtcInterval(interval.start, interval.end),
    )
  ) {
    return [];
  }

  try {
    const parsed = intervals.map((interval) => ({
      start: Temporal.Instant.from(interval.start),
      end: Temporal.Instant.from(interval.end),
    }));

    parsed.sort((a, b) => Temporal.Instant.compare(a.start, b.start));

    const merged: Array<{
      start: Temporal.Instant;
      end: Temporal.Instant;
    }> = [];

    for (const interval of parsed) {
      const last = merged[merged.length - 1];

      if (last && Temporal.Instant.compare(interval.start, last.end) <= 0) {
        if (Temporal.Instant.compare(interval.end, last.end) > 0) {
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
