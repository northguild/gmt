// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import {
  calendarOfAllDateValues,
  halfOpenIntersection,
  parseCalendarDateValue,
} from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return how many distinct calendar dates two date intervals share.
 *
 * - Half-open: an interval holds every date `d` with `start <= d < end`. The count is the number
 *   of days in the intersection `[max(aStart, bStart), min(aEnd, bEnd))`, that is
 *   `min(aEnd, bEnd) - max(aStart, bStart)` in days.
 * - Touching intervals (`aEnd === bStart`) share no day and count `0`; so does an empty interval.
 * - Returns `0` when the intervals share no day (a well-defined answer, not invalid input).
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 *
 * - Accepts RFC 9557 calendar-annotated PlainDate strings — E5 (issue #78). All four arguments
 *   must name the same calendar (a bare ISO string names `iso8601`); different calendars return
 *   `null`, as Temporal's `until` throws when `CalendarEquals` is false.
 * - Compatibility: before 1.16.0 arguments could name different calendars. Since 1.16.0 calendar
 *   strings are RFC 9557 (ISO digits, `[u-ca=<id>]`, canonical calendar ids); see
 *   `isValidCalendarDate`.
 *
 * @param aStart ISO 8601 date string for the first interval start, optionally calendar-annotated
 * @param aEnd ISO 8601 date string for the first interval end, optionally calendar-annotated
 * @param bStart ISO 8601 date string for the second interval start, optionally calendar-annotated
 * @param bEnd ISO 8601 date string for the second interval end, optionally calendar-annotated
 * @returns number of shared calendar dates, `0` when disjoint, or null on invalid input
 *
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // 90 (04-01 up to, not including, 06-30)
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-12-31", "2024-02-01", "2024-02-29") // 28
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-06-29", "2024-12-31") // 1
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31") // 0 (touching)
 * @example intervalOverlappingDaysDate("2024-10-01", "2024-10-31", "2024-10-03[u-ca=hebrew]", "2024-11-15") // null (different calendars)
 * @example intervalOverlappingDaysDate("invalid", "2024-06-30", "2024-04-01", "2024-12-31") // null
 */
export function intervalOverlappingDaysDate(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number | null {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return null;
  }

  if (
    !isValidCalendarDate(aStart) ||
    !isValidCalendarDate(aEnd) ||
    !isValidCalendarDate(bStart) ||
    !isValidCalendarDate(bEnd)
  ) {
    return null;
  }

  // The count is a difference between two of the endpoints, so all four must name one calendar
  // (TC39 CalendarEquals, which makes until throw across calendars).
  if (calendarOfAllDateValues([aStart, aEnd, bStart, bEnd]) === null) {
    return null;
  }

  try {
    const aS = parseCalendarDateValue(aStart);
    const aE = parseCalendarDateValue(aEnd);
    const bS = parseCalendarDateValue(bStart);
    const bE = parseCalendarDateValue(bEnd);

    if (Temporal.PlainDate.compare(aS, aE) > 0) {
      return null;
    }

    if (Temporal.PlainDate.compare(bS, bE) > 0) {
      return null;
    }

    const shared = halfOpenIntersection(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainDate.compare,
    );

    if (shared === null) {
      return 0;
    }

    // A day is the same length in every supported calendar, so the day count is measured in
    // iso8601, which never changes the answer.
    return shared.start
      .withCalendar("iso8601")
      .until(shared.end.withCalendar("iso8601"), { largestUnit: "day" }).days;
  } catch {
    return null;
  }
}
