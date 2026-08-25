import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllDateValues,
  formatDateInCalendar,
  parseCalendarDateValue,
} from "../../internal";
import { isValidDateInterval } from "./validate";

/**
 * Collapse a list of date intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionDate`, which is pairwise only.
 * - Intervals are merged when they overlap or share an endpoint exactly (adjacent intervals,
 *   e.g. `aEnd === bStart`, ARE merged — same rule as `intervalUnionDate`).
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list.
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO PlainDate strings, or when any element has
 *   `start > end`.
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). Since the result is
 *   date *values*, every `start`/`end` across the whole list must carry the *same* calendar tag
 *   (or all be bare ISO); any mismatch returns `[]` (E5 decision of record D4).
 *
 * @param intervals array of `{ start, end }` records, optionally calendar-annotated
 * @returns the minimum set of non-overlapping `{ start, end }` records, sorted by start, or `[]` on invalid input / mismatched calendars
 *
 * @example mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-05", end: "2024-01-15" }]) // [{ start: "2024-01-01", end: "2024-01-15" }]
 * @example mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-10", end: "2024-01-20" }]) // [{ start: "2024-01-01", end: "2024-01-20" }] (adjacent, merged)
 * @example mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-10", end: "2024-01-15" }]) // [{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-10", end: "2024-01-15" }] (disjoint)
 * @example mergeIntervalsDate([]) // []
 * @example mergeIntervalsDate([{ start: "2024-01-10", end: "2024-01-01" }]) // []
 */
export function mergeIntervalsDate(
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
        isValidDateInterval(interval.start, interval.end),
    )
  ) {
    return [];
  }

  const calendar = calendarOfAllDateValues(
    intervals.flatMap((interval) => [interval.start, interval.end]),
  );
  if (!calendar) {
    return [];
  }

  try {
    const parsed = intervals.map((interval) => ({
      start: parseCalendarDateValue(interval.start),
      end: parseCalendarDateValue(interval.end),
    }));

    parsed.sort((a, b) => Temporal.PlainDate.compare(a.start, b.start));

    const merged: Array<{
      start: Temporal.PlainDate;
      end: Temporal.PlainDate;
    }> = [];

    for (const interval of parsed) {
      const last = merged[merged.length - 1];

      if (last && Temporal.PlainDate.compare(interval.start, last.end) <= 0) {
        if (Temporal.PlainDate.compare(interval.end, last.end) > 0) {
          last.end = interval.end;
        }
      } else {
        merged.push({ start: interval.start, end: interval.end });
      }
    }

    return merged.map((interval) => ({
      start: formatDateInCalendar(interval.start, calendar),
      end: formatDateInCalendar(interval.end, calendar),
    }));
  } catch {
    return [];
  }
}
