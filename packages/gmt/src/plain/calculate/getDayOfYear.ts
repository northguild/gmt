import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return the ordinal day-of-year (1-based) for `value`.
 *
 * - Jan 1 is 1; Dec 31 is 365 (common year) or 366 (leap year).
 * - Returns null on invalid input.
 *
 * @param value ISO PlainDate string
 * @returns 1-366, or null on invalid input
 *
 * @example getDayOfYear("2024-01-01") // 1
 * @example getDayOfYear("2024-12-31") // 366 (leap year)
 * @example getDayOfYear("2023-12-31") // 365
 * @example getDayOfYear("2024-03-01") // 61 (after the Feb 29 leap day)
 * @example getDayOfYear("invalid") // null
 */
export function getDayOfYear(value: string): number | null {
  if (!isValidDate(value)) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    return date.dayOfYear;
  } catch {
    return null;
  }
}
