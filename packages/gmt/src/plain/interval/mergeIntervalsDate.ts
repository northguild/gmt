import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllDateValues,
  formatDateInCalendar,
  halfOpenMerge,
  parseCalendarDateValue,
} from "../../internal";
import { isValidDateInterval } from "./validate";

/**
 * Collapse a list of date intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionDate`, which is pairwise only.
 * - Half-open: an interval holds every `t` with `start <= t < end`. Overlapping intervals and
 *   touching intervals (`aEnd === bStart`) join into one run; any gap, even one unit, keeps them
 *   apart (CORE-6's `mergeIntervals`).
 * - An empty interval (`start === end`) holds nothing: it is absorbed by a run it touches or lies
 *   in, and dropped otherwise, so every returned interval is non-empty.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list.
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO PlainDate strings, or when any element has
 *   `start > end`.
 * - Accepts RFC 9557 calendar-annotated PlainDate strings — E5 (issue #78). Since the result is
 *   date *values*, every `start`/`end` across the whole list must carry the *same* calendar tag
 *   (or all be bare ISO); any mismatch returns `[]` (E5 decision of record D4).
 *
 * @param intervals array of `{ start, end }` records, optionally calendar-annotated
 * @returns the minimum set of non-overlapping `{ start, end }` records, sorted by start, or `[]` on invalid input / mismatched calendars
 *
 * @example mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-05", end: "2024-01-15" }]) // [{ start: "2024-01-01", end: "2024-01-15" }]
 * @example mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-10", end: "2024-01-20" }]) // [{ start: "2024-01-01", end: "2024-01-20" }] (touching)
 * @example mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-06", end: "2024-01-10" }]) // [{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-06", end: "2024-01-10" }] (01-05 is in neither)
 * @example mergeIntervalsDate([{ start: "2024-01-01", end: "2024-01-01" }]) // [] (empty interval)
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

    const merged = halfOpenMerge(parsed, Temporal.PlainDate.compare);

    return merged.map((interval) => ({
      start: formatDateInCalendar(interval.start, calendar),
      end: formatDateInCalendar(interval.end, calendar),
    }));
  } catch {
    return [];
  }
}
