import { zonelessCalendarDate } from "../../internal";

/**
 * Return the ISO 8601 ordinal date — calendar year and day of year — for `value`.
 *
 * - `dayOfYear` is 1–365, or 1–366 in a leap year.
 * - `year` is the calendar year, unlike `getIsoWeekDate`'s week-numbering year: an ordinal
 *   date never disagrees with the calendar year it is written beside.
 * - `value` must be zoneless — an ISO date or datetime, as `isValidIsoDateLike` accepts. See
 *   `getIsoWeekDate` for why a moment is not accepted here.
 * - Returns null on invalid input.
 *
 * @param value zoneless ISO 8601 date or datetime string (e.g. "2024-06-15")
 * @returns { year, dayOfYear }, or null on invalid input
 *
 * @example getOrdinalDate("2024-01-01") // { year: 2024, dayOfYear: 1 }
 * @example getOrdinalDate("2024-06-15") // { year: 2024, dayOfYear: 167 }
 * @example getOrdinalDate("2024-12-31") // { year: 2024, dayOfYear: 366 } (leap year)
 * @example getOrdinalDate("2023-12-31") // { year: 2023, dayOfYear: 365 }
 * @example getOrdinalDate("2024-03-01") // { year: 2024, dayOfYear: 61 } (after the Feb 29 leap day)
 * @example getOrdinalDate("2024-06-15T12:00:00Z") // null (a moment, not a calendar date)
 * @example getOrdinalDate("invalid") // null
 */
export function getOrdinalDate(
  value: string,
): { year: number; dayOfYear: number } | null {
  const date = zonelessCalendarDate(value);
  if (!date) return null;

  return { year: date.year, dayOfYear: date.dayOfYear };
}
