import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllDateValues,
  closedXorSweep,
  formatDateInCalendar,
  parseCalendarDateValue,
} from "../../internal";
import { isValidDateInterval } from "./validate";

/**
 * Return the symmetric difference across a list of date intervals — the set of dates covered
 * by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorDate`, which is pairwise only.
 * - Implemented as a closed-interval coverage sweep: each interval opens at its start and closes
 *   at its end, and the result is every maximal run where the coverage count is odd. No boundary
 *   is computed past an end, so an interval may end on the last representable date
 *   (`+275760-09-13`). For two overlapping intervals this reduces to exactly `intervalXorDate`'s
 *   pairwise result.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list, and `[]` when every date is covered an even number of times
 *   (e.g. two identical intervals cancel out).
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of valid ISO PlainDate strings, or when any element has
 *   `start > end`.
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). Since the result is
 *   date *values*, every `start`/`end` across the whole list must carry the *same* calendar tag
 *   (or all be bare ISO); any mismatch returns `[]` (E5 decision of record D4). Coincident sweep events are
 *   grouped with `Temporal.PlainDate.compare`, which orders by ISO date and ignores the calendar.
 *
 * @param intervals array of `{ start, end }` records, optionally calendar-annotated
 * @returns array of `{ start, end }` records covered an odd number of times, or `[]` on invalid input / mismatched calendars
 *
 * @example intervalXorAllDate([{ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-05", end: "2024-01-15" }, { start: "2024-01-08", end: "2024-01-20" }]) // [{ start: "2024-01-01", end: "2024-01-04" }, { start: "2024-01-08", end: "2024-01-10" }, { start: "2024-01-16", end: "2024-01-20" }]
 * @example intervalXorAllDate([{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-01", end: "2024-01-05" }]) // [] (identical intervals cancel out)
 * @example intervalXorAllDate([]) // []
 * @example intervalXorAllDate([{ start: "2024-01-10", end: "2024-01-01" }]) // []
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

    return closedXorSweep(parsed, {
      compare: Temporal.PlainDate.compare,
      stepUp: (value) => value.add({ days: 1 }),
      stepDown: (value) => value.subtract({ days: 1 }),
    }).map(({ start, end }) => ({
      start: formatDateInCalendar(start, calendar),
      end: formatDateInCalendar(end, calendar),
    }));
  } catch {
    return [];
  }
}
