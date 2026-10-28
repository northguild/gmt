import { plainMonthDayOf } from "../../internal/inputChecks";

/**
 * Check whether two month-day strings (`--MM-DD`, or `MM-DD`) name the same day of the year.
 *
 * - Accepts both input forms, so `12-25` and `--12-25` are equal.
 * - The year is not part of a month-day: `--02-29` is not equal to `--02-28`.
 * - Returns `false` if either input is invalid or not in the ISO calendar.
 *
 * @param a month-day string
 * @param b month-day string
 * @returns `true` only when both are valid and name the same month and day, or `false` on invalid input
 *
 * @example areMonthDaysEqual("12-25", "--12-25") // true
 * @example areMonthDaysEqual("--02-29", "--02-28") // false
 * @example areMonthDaysEqual("--02-30", "--02-30") // false
 */
export function areMonthDaysEqual(a: string, b: string): boolean {
  const first = plainMonthDayOf(a);
  const second = plainMonthDayOf(b);
  if (first === null || second === null) {
    return false;
  }

  try {
    return first.equals(second);
  } catch {
    return false;
  }
}
