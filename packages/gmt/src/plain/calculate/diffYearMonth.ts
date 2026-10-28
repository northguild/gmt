import { plainYearMonthOf } from "../../internal/inputChecks";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";

/**
 * Return the whole years or months from year-month `a` to year-month `b`.
 *
 * - `unit` is `"years"`, `"year"`, `"months"` or `"month"`; any other unit returns `null`
 *   (Temporal's DifferenceTemporalPlainYearMonth allows years and months only).
 * - Direction is from `a` to `b`: positive when `b` is later, negative when earlier.
 * - The result is truncated toward zero, so `2025-11` to `2027-10` is 1 year; never `-0`.
 * - The lowest year-month (`-271821-04`) can only be compared with itself (`0`); against any
 *   other year-month, day 1 is out of range and the result is `null`.
 * - In `years`, a pair whose next whole year passes `+275760-09` or `-271821-04` returns `null`
 *   (Temporal's ComputeNudgeWindow computes the end bound one year further; the call throws).
 * - Returns `null` for a string that is not a year-month.
 *
 * @param a year-month string for the start
 * @param b year-month string for the end
 * @param unit unit to measure in
 * @returns the difference in `unit`, or null on invalid input
 *
 * @example diffYearMonth("2025-11", "2026-10", "months") // 11
 * @example diffYearMonth("2026-10", "2025-11", "months") // -11
 * @example diffYearMonth("2025-11", "2027-10", "years") // 1
 * @example diffYearMonth("2026-10", "2026-11", "days") // null
 * @example diffYearMonth("2026-10", "2026-10-01", "months") // null
 */
export function diffYearMonth(
  a: string,
  b: string,
  unit: "years" | "year" | "months" | "month",
): number | null {
  try {
    const start = plainYearMonthOf(a);
    const end = plainYearMonthOf(b);
    const resolved = resolveDurationUnit(unit);
    if (
      start === null ||
      end === null ||
      (resolved !== "years" && resolved !== "months")
    ) {
      return null;
    }
    const duration = start.until(end, {
      largestUnit: resolved,
      smallestUnit: resolved,
    });
    // `+ 0` turns a -0 into 0.
    return duration[resolved] + 0;
  } catch {
    return null;
  }
}
