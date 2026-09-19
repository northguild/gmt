// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllZonedValues,
  formatZonedInCalendar,
  halfOpenMerge,
  parseCalendarZonedValue,
} from "../../internal";
import { isValidCalendarZonedInterval } from "./validate";

/**
 * Collapse a list of zoned intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionZoned`, which is pairwise only.
 * - Comparison and merging use each interval's instant, so intervals may carry different time
 *   zones.
 * - Intervals are half-open `[start, end)`, the same rule as `mergeIntervals`. They are merged
 *   when they overlap or touch (one's `end` is the same instant as the other's `start`), so the
 *   runs returned never touch.
 * - An empty interval (`start` and `end` the same instant) holds no instant: it is absorbed when
 *   it touches or lies inside a run and dropped otherwise, so it never bridges a gap. A list of
 *   only empty intervals returns `[]`, the same value as invalid input — use
 *   `isValidCalendarZonedInterval` to tell them apart.
 * - Order of the input list does not matter; the result is sorted by start instant. Each merged
 *   record's `start`/`end` strings carry the time zone of whichever input interval contributed
 *   that boundary.
 * - Returns `[]` for an empty list.
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO ZonedDateTime strings, or when any element has
 *   `start > end` or a leap-second string.
 * - Accepts RFC 9557 calendar-annotated zoned strings (as produced by `convertZonedToCalendar`) as
 *   well as bare ISO ones — E7 (issue #152) — but **rejects a mismatched set**: every endpoint in
 *   the list must name the same calendar system (E7's D4-zoned). This function returns *values*
 *   the caller reads back as datetimes, and an array whose elements carried different calendar
 *   tags would be unreadable as a set. A mismatch returns `[]`.
 * - Output boundaries are re-derived in the resolved calendar via `formatZonedInCalendar`, never
 *   copied from an input string (E7's D7-zoned).
 *
 * @param intervals array of `{ start, end }` records
 * @returns the minimum set of non-overlapping `{ start, end }` records, sorted by start, or `[]` on invalid input
 *
 * @example mergeIntervalsZoned([{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-10T00:00:00+00:00[UTC]" }, { start: "2024-01-05T00:00:00+00:00[UTC]", end: "2024-01-15T00:00:00+00:00[UTC]" }]) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-15T00:00:00+00:00[UTC]" }]
 * @example mergeIntervalsZoned([{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }, { start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }]) // [{ start: "2024-01-01T09:00:00+00:00[UTC]", end: "2024-01-01T17:00:00+00:00[UTC]" }] (touching)
 * @example mergeIntervalsZoned([{ start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T12:00:00+00:00[UTC]" }]) // [] (an empty interval holds no instant)
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
        isValidCalendarZonedInterval(interval.start, interval.end),
    )
  ) {
    return [];
  }

  // D4-zoned reject gate: every endpoint across every interval must agree on a calendar, or there
  // is no calendar to express the merged boundaries in.
  const calendar = calendarOfAllZonedValues(
    intervals.flatMap((interval) => [interval.start, interval.end]),
  );
  if (!calendar) {
    return [];
  }

  try {
    const parsed = intervals.map((interval) => ({
      start: parseCalendarZonedValue(interval.start),
      end: parseCalendarZonedValue(interval.end),
    }));

    // Sorted, disjoint, non-touching, non-empty runs; each boundary keeps the ZonedDateTime (and
    // so the zone) of the interval that contributed it.
    return halfOpenMerge(parsed, Temporal.ZonedDateTime.compare).map(
      (interval) => ({
        start: formatZonedInCalendar(interval.start, calendar),
        end: formatZonedInCalendar(interval.end, calendar),
      }),
    );
  } catch {
    return [];
  }
}
