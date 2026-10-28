import { plainYearMonthOf } from "../../internal/inputChecks";

/**
 * Check whether two year-month strings (`YYYY-MM`) name the same year and month.
 *
 * - Accepts both year forms, so `2026-10` and `+002026-10` are equal.
 * - Returns `false` if either input is invalid or not in the ISO calendar.
 *
 * @param a year-month string
 * @param b year-month string
 * @returns `true` only when both are valid and name the same year and month, or `false` on invalid input
 *
 * @example areYearMonthsEqual("+002026-10", "2026-10") // true
 * @example areYearMonthsEqual("2026-10", "2025-10") // false
 * @example areYearMonthsEqual("2026-13", "2026-13") // false
 */
export function areYearMonthsEqual(a: string, b: string): boolean {
  const first = plainYearMonthOf(a);
  const second = plainYearMonthOf(b);
  if (first === null || second === null) {
    return false;
  }

  try {
    return first.equals(second);
  } catch {
    return false;
  }
}
