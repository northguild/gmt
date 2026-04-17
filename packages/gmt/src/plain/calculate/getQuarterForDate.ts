import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return the quarter of the year (1-4) for a given ISO date.
 *
 * - Returns the quarter (1-4) containing the input date.
 * - Q1 = months 1-3, Q2 = months 4-6, Q3 = months 7-9, Q4 = months 10-12.
 * - Validates input using isValidDate.
 *
 * @param value ISO PlainDate string
 * @returns number (1-4) or null for invalid input
 *
 * @example getQuarterForDate("2024-01-15") // 1
 * @example getQuarterForDate("2024-04-15") // 2
 * @example getQuarterForDate("2024-07-15") // 3
 * @example getQuarterForDate("2024-10-15") // 4
 * @example getQuarterForDate("invalid") // null
 */
export function getQuarterForDate(value: string): number | null {
  if (!isValidDate(value)) {
    return null;
  }

  try {
    const date = Temporal.PlainDate.from(value);
    return Math.floor((date.month - 1) / 3) + 1;
  } catch {
    return null;
  }
}
