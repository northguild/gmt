import { plainYearMonthOf } from "../../internal/inputChecks";

/**
 * Return the number of days in a year-month.
 *
 * - 28–31 depending on the month; February varies by leap year.
 * - The two limit months, `-271821-04` and `+275760-09`, have 30 days, though Temporal holds only
 *   part of each.
 * - Returns null on invalid input.
 *
 * @param value a year-month, `YYYY-MM`
 * @returns number of days in the month (28-31), or null on invalid input
 *
 * @example getDaysInYearMonth("2024-02") // 29 (leap year)
 * @example getDaysInYearMonth("2023-02") // 28
 * @example getDaysInYearMonth("2026-04") // 30
 * @example getDaysInYearMonth("2026-10") // 31
 * @example getDaysInYearMonth("2026-10-01") // null
 */
export function getDaysInYearMonth(value: string): number | null {
  const pym = plainYearMonthOf(value);
  if (pym === null) return null;

  try {
    return pym.daysInMonth;
  } catch {
    return null;
  }
}
