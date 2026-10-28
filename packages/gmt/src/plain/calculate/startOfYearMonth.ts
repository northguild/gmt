import { plainYearMonthOf } from "../../internal/inputChecks";

/**
 * The first day of a year-month, as an ISO date.
 *
 * - The lowest year-month, `-271821-04`, holds only `-271821-04-19` to `-271821-04-30`, so its
 *   first day is not a PlainDate and the result is `""`.
 *
 * @param value a year-month, `YYYY-MM`
 * @returns the ISO date `YYYY-MM-01`, or `""` when `value` is not a valid year-month or its first
 * day is outside the PlainDate range
 *
 * @example startOfYearMonth("2026-10") // "2026-10-01"
 * @example startOfYearMonth("-000001-12") // "-000001-12-01"
 * @example startOfYearMonth("-271821-04") // "" (day 1 is below the PlainDate range)
 * @example startOfYearMonth("2026-13") // ""
 * @example startOfYearMonth("2026-10-01") // ""
 */
export function startOfYearMonth(value: string): string {
  const pym = plainYearMonthOf(value);
  if (pym === null) return "";

  try {
    return pym.toPlainDate({ day: 1 }).toString();
  } catch {
    return "";
  }
}
