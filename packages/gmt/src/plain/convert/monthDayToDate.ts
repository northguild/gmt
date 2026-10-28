import { plainMonthDayOf } from "../../internal/inputChecks";

/**
 * The ISO date of a month-day in a given year.
 *
 * - `--02-29` in a year that is not a leap year gives 28 February. This is the ~constrain~ step
 *   of Temporal's `PlainMonthDay.prototype.toPlainDate` (CalendarDateFromFields with
 *   ~constrain~). The result is never 1 March and never `""`.
 * - `year` must be an integer. A fractional, string or `bigint` year gives `""`; Temporal would
 *   truncate or coerce it, and gmt does not.
 * - Only the ISO calendar is read; a month-day with another calendar annotation gives `""`.
 *
 * @param monthDay a month-day, `--MM-DD` or `MM-DD`
 * @param year an integer, as Temporal's ISO calendar counts it: 0 is 1 BCE and -1 is 2 BCE
 * @returns the ISO date, or `""` when `monthDay` is not a valid month-day, `year` is not an
 * integer, or the date falls outside the PlainDate range
 *
 * @example monthDayToDate("--12-25", 2024) // "2024-12-25"
 * @example monthDayToDate("--02-29", 2024) // "2024-02-29"
 * @example monthDayToDate("--02-29", 2023) // "2023-02-28" (constrained)
 * @example monthDayToDate("--02-30", 2024) // ""
 * @example monthDayToDate("--12-25", 2024.5) // ""
 * @example monthDayToDate("--09-14", 275760) // "" (above the PlainDate range)
 */
export function monthDayToDate(monthDay: string, year: number): string {
  if (!Number.isInteger(year)) return "";
  const pmd = plainMonthDayOf(monthDay);
  if (pmd === null) return "";

  try {
    return pmd.toPlainDate({ year }).toString();
  } catch {
    return "";
  }
}
