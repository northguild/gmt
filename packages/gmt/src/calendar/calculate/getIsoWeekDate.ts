import { zonelessCalendarDate } from "../../internal";

/**
 * Return the ISO 8601 week date — week-numbering year, week and weekday — for `value`.
 *
 * Vessel schedules, production plans and retail reports are published by week number, and a
 * week number alone is ambiguous: the week-numbering year is not the calendar year at either
 * end of a year, so all three fields come back together rather than as three calls a caller
 * could combine inconsistently.
 *
 * - `year` is the ISO week-numbering year (`Temporal.PlainDate.yearOfWeek`), which differs
 *   from the calendar year for late-December and early-January dates.
 * - `week` is 1–53. ISO week 1 is the week containing the year's first Thursday, so a
 *   week-numbering year has 53 weeks roughly every five to six years.
 * - `weekday` is 1 (Monday) through 7 (Sunday).
 * - `value` must be zoneless — an ISO date or datetime, as `isValidIsoDateLike` accepts. An
 *   offset, a `Z` or a bracketed zone makes it a moment rather than a calendar date; convert
 *   it in the zone you mean first (`convertUtcToZoned` then `convertZonedToPlainDateTime`),
 *   or floor it with `floorToZone`.
 * - Returns null on invalid input.
 *
 * @param value zoneless ISO 8601 date or datetime string (e.g. "2024-06-15")
 * @returns { year, week, weekday }, or null on invalid input
 *
 * @example getIsoWeekDate("2024-06-15") // { year: 2024, week: 24, weekday: 6 }
 * @example getIsoWeekDate("2027-01-01") // { year: 2026, week: 53, weekday: 5 } (week-year 2026, not 2027)
 * @example getIsoWeekDate("2024-12-30") // { year: 2025, week: 1, weekday: 1 } (a December date in the next week-year)
 * @example getIsoWeekDate("2020-12-31") // { year: 2020, week: 53, weekday: 4 } (a 53-week ISO year)
 * @example getIsoWeekDate("2024-06-15T23:59:59") // { year: 2024, week: 24, weekday: 6 }
 * @example getIsoWeekDate("2024-06-15T12:00:00Z") // null (a moment, not a calendar date)
 * @example getIsoWeekDate("invalid") // null
 */
export function getIsoWeekDate(
  value: string,
): { year: number; week: number; weekday: number } | null {
  const date = zonelessCalendarDate(value);
  if (!date) return null;

  const year = date.yearOfWeek;
  const week = date.weekOfYear;
  if (year === undefined || week === undefined) return null;

  return { year, week, weekday: date.dayOfWeek };
}
