import { plainDateOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";

/**
 * Restrict `value` to the range [`min`, `max`].
 *
 * - Returns `value` if it falls within the bounds (inclusive on both ends).
 * - Returns `min` if `value` is before `min`.
 * - Returns `max` if `value` is after `max`.
 * - Returns `""` if any input is invalid or `min > max`.
 *
 * @param value ISO PlainDate string to clamp
 * @param min ISO PlainDate string for the lower bound (inclusive)
 * @param max ISO PlainDate string for the upper bound (inclusive)
 * @returns The clamped date string, or "" on invalid input
 *
 * @example clampDate("2024-03-15", "2024-03-01", "2024-03-31") // "2024-03-15"
 * @example clampDate("2024-02-01", "2024-03-01", "2024-03-31") // "2024-03-01"
 * @example clampDate("2024-05-01", "2024-03-01", "2024-03-31") // "2024-03-31"
 * @example clampDate("2024-03-15", "2024-03-31", "2024-03-01") // ""
 * @example clampDate("invalid", "2024-03-01", "2024-03-31") // ""
 */
export function clampDate(value: string, min: string, max: string): string {
  const v = plainDateOf(value);
  const mn = plainDateOf(min);
  const mx = plainDateOf(max);
  if (v === null || mn === null || mx === null) {
    return "";
  }

  try {
    if (Temporal.PlainDate.compare(mn, mx) === 1) {
      return "";
    }

    const cmpMin = Temporal.PlainDate.compare(v, mn);
    const cmpMax = Temporal.PlainDate.compare(v, mx);

    if (cmpMin < 0) {
      return mn.toString();
    }
    if (cmpMax > 0) {
      return mx.toString();
    }

    return v.toString();
  } catch {
    return "";
  }
}
