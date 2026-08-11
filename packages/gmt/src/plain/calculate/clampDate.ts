import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

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
  if (!isValidDate(value) || !isValidDate(min) || !isValidDate(max)) {
    return "";
  }

  try {
    const v = Temporal.PlainDate.from(value);
    const mn = Temporal.PlainDate.from(min);
    const mx = Temporal.PlainDate.from(max);

    if (Temporal.PlainDate.compare(mn, mx) === 1) {
      return "";
    }

    const cmpMin = Temporal.PlainDate.compare(v, mn);
    const cmpMax = Temporal.PlainDate.compare(v, mx);

    if (cmpMin < 0) {
      return min;
    }
    if (cmpMax > 0) {
      return max;
    }

    return value;
  } catch {
    return "";
  }
}
