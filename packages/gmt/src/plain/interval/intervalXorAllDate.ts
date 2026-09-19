// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllDateValues,
  formatDateInCalendar,
  halfOpenXor,
  parseCalendarDateValue,
} from "../../internal";
import { isValidDateInterval } from "./validate";

/**
 * Return the symmetric difference across a list of date intervals — the set of dates covered
 * by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorDate`, which is pairwise only.
 * - Half-open: an interval holds every `t` with `start <= t < end`. The result is every maximal
 *   run covered an odd number of times, computed as a coverage-parity sweep over the start and
 *   end boundaries. Runs end exactly at a boundary; no boundary is ever stepped by one unit, so
 *   an interval may end on the type's last value without overflow or midnight wrap.
 * - Touching odd runs join into one run; an empty interval (`start === end`) contributes nothing.
 *   For two intervals this is exactly `intervalXorDate`'s pairwise result.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list, and `[]` when every date is covered an even number of times
 *   (e.g. two identical intervals cancel out).
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO PlainDate strings, or when any element has
 *   `start > end`.
 * - Accepts RFC 9557 calendar-annotated PlainDate strings — E5 (issue #78). Since the result is
 *   date *values*, every `start`/`end` across the whole list must carry the *same* calendar tag
 *   (or all be bare ISO); any mismatch returns `[]` (E5 decision of record D4). Coincident sweep events are
 *   grouped with `Temporal.PlainDate.compare`, which orders by ISO date and ignores the calendar.
 *
 * @param intervals array of `{ start, end }` records, optionally calendar-annotated
 * @returns array of `{ start, end }` records covered an odd number of times, or `[]` on invalid input / mismatched calendars
 *
 * @example intervalXorAllDate([{ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-05", end: "2024-01-15" }]) // [{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-10", end: "2024-01-15" }]
 * @example intervalXorAllDate([{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-10" }]) // [{ start: "2024-01-01", end: "2024-01-10" }] (touching)
 * @example intervalXorAllDate([]) // []
 */
export function intervalXorAllDate(
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

    return halfOpenXor(parsed, Temporal.PlainDate.compare).map(
      ({ start, end }) => ({
        start: formatDateInCalendar(start, calendar),
        end: formatDateInCalendar(end, calendar),
      }),
    );
  } catch {
    return [];
  }
}
