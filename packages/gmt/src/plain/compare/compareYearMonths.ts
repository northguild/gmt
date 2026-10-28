import { plainYearMonthOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Compare two year-month strings (`YYYY-MM`) in calendar order: year first, then month.
 *
 * - Accepts both year forms, so `2026-10` and `+002026-10` compare equal.
 * - Negative years sort before year 0: `-000001-12` is before `0000-01`.
 * - Returns `null` if either input is invalid or not in the ISO calendar.
 *
 * @param a year-month string
 * @param b year-month string
 * @returns -1, 0, or 1, or null on invalid input
 *
 * @example compareYearMonths("2026-09", "2026-10") // -1
 * @example compareYearMonths("+002026-10", "2026-10") // 0
 * @example compareYearMonths("-000001-12", "0000-01") // -1
 * @example compareYearMonths("2026-13", "2026-10") // null
 * @example ["2026-10", "2025-12", "2026-01"].sort((a, b) => compareYearMonths(a, b) ?? 0) // ["2025-12", "2026-01", "2026-10"] (validate every entry first)
 */
export function compareYearMonths(a: string, b: string): number | null {
  const first = plainYearMonthOf(a);
  const second = plainYearMonthOf(b);
  if (first === null || second === null) {
    return null;
  }

  try {
    return Temporal.PlainYearMonth.compare(first, second);
  } catch {
    return null;
  }
}
