import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return the number of days in the calendar year containing `value`.
 *
 * - 365 for a common year, 366 for a leap year.
 * - Returns null on invalid input.
 *
 * @param value ISO PlainDate string
 * @returns 365 or 366, or null on invalid input
 *
 * @example getDaysInYear("2024-06-15") // 366 (leap year)
 * @example getDaysInYear("2023-06-15") // 365
 * @example getDaysInYear("invalid") // null
 */
export function getDaysInYear(value: string): number | null {
  if (!isValidDate(value)) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    return date.daysInYear;
  } catch {
    return null;
  }
}
