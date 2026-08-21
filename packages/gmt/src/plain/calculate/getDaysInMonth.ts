import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return the number of days in the month containing `value`.
 *
 * - 28–31 depending on the month; February varies by leap year.
 * - Returns null on invalid input.
 *
 * @param value ISO PlainDate string
 * @returns number of days in the month (28-31), or null on invalid input
 *
 * @example getDaysInMonth("2024-02-15") // 29 (leap year)
 * @example getDaysInMonth("2023-02-15") // 28
 * @example getDaysInMonth("2024-04-01") // 30
 * @example getDaysInMonth("2024-01-01") // 31
 * @example getDaysInMonth("invalid") // null
 */
export function getDaysInMonth(value: string): number | null {
  if (!isValidDate(value)) return null;

  try {
    const date = Temporal.PlainDate.from(value);
    return date.daysInMonth;
  } catch {
    return null;
  }
}
