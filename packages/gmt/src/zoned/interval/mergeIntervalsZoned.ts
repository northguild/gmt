import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isValidZonedInterval } from "./validate";

/**
 * Collapse a list of zoned intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionZoned`, which is pairwise only.
 * - Comparison and merging use each interval's instant, so intervals may carry different time
 *   zones.
 * - Intervals are merged when they overlap or share an instant exactly (adjacent intervals
 *   ARE merged).
 * - Order of the input list does not matter; the result is sorted by start instant. Each merged
 *   record's `start`/`end` strings carry the time zone of whichever input interval contributed
 *   that boundary.
 * - Returns `[]` for an empty list.
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO ZonedDateTime strings, or when any element has
 *   `start > end` or a leap-second string.
 *
 * @param intervals array of `{ start, end }` records
 * @returns the minimum set of non-overlapping `{ start, end }` records, sorted by start, or `[]` on invalid input
 *
 * @example mergeIntervalsZoned([{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-10T00:00:00+00:00[UTC]" }, { start: "2024-01-05T00:00:00+00:00[UTC]", end: "2024-01-15T00:00:00+00:00[UTC]" }]) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-15T00:00:00+00:00[UTC]" }]
 * @example mergeIntervalsZoned([]) // []
 */
export function mergeIntervalsZoned(
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
        isValidZonedInterval(interval.start, interval.end),
    )
  ) {
    return [];
  }

  try {
    const parsed = intervals.map((interval) => ({
      start: Temporal.ZonedDateTime.from(interval.start),
      end: Temporal.ZonedDateTime.from(interval.end),
    }));

    parsed.sort((a, b) =>
      Temporal.Instant.compare(a.start.toInstant(), b.start.toInstant()),
    );

    const merged: Array<{
      start: Temporal.ZonedDateTime;
      end: Temporal.ZonedDateTime;
    }> = [];

    for (const interval of parsed) {
      const last = merged[merged.length - 1];

      if (
        last &&
        Temporal.Instant.compare(
          interval.start.toInstant(),
          last.end.toInstant(),
        ) <= 0
      ) {
        if (
          Temporal.Instant.compare(
            interval.end.toInstant(),
            last.end.toInstant(),
          ) > 0
        ) {
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
