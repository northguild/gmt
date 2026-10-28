import { plainYearMonthOf } from "../../internal/inputChecks";

/**
 * The last day of a year-month, as an ISO date.
 *
 * - February ends on the 29th in a leap year and on the 28th in any other.
 * - The highest year-month, `+275760-09`, holds only `+275760-09-01` to `+275760-09-13`, so its
 *   last day is not a PlainDate and the result is `""`.
 *
 * @param value a year-month, `YYYY-MM`
 * @returns the ISO date of the last day, or `""` when `value` is not a valid year-month or its
 * last day is outside the PlainDate range
 *
 * @example endOfYearMonth("2026-10") // "2026-10-31"
 * @example endOfYearMonth("2024-02") // "2024-02-29" (leap year)
 * @example endOfYearMonth("2023-02") // "2023-02-28"
 * @example endOfYearMonth("+275760-09") // "" (day 30 is above the PlainDate range)
 * @example endOfYearMonth("2026-13") // ""
 */
export function endOfYearMonth(value: string): string {
  const pym = plainYearMonthOf(value);
  if (pym === null) return "";

  try {
    return pym.toPlainDate({ day: pym.daysInMonth }).toString();
  } catch {
    return "";
  }
}
