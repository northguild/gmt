import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

/**
 * Return the quarter of the year (1-4) for a given ISO datetime.
 *
 * - Returns the quarter (1-4) containing the input datetime.
 * - Q1 = months 1-3, Q2 = months 4-6, Q3 = months 7-9, Q4 = months 10-12.
 * - Validates input using isValidDateTime.
 *
 * @param value ISO PlainDateTime string
 * @returns number (1-4) or null for invalid input
 *
 * @example getQuarterForDateTime("2024-01-15T12:00:00") // 1
 * @example getQuarterForDateTime("2024-04-15T12:00:00") // 2
 * @example getQuarterForDateTime("2024-07-15T12:00:00") // 3
 * @example getQuarterForDateTime("2024-10-15T12:00:00") // 4
 * @example getQuarterForDateTime("invalid") // null
 */
export function getQuarterForDateTime(value: string): number | null {
  if (!isValidDateTime(value)) {
    return null;
  }

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return Math.floor((dateTime.month - 1) / 3) + 1;
  } catch {
    return null;
  }
}
