import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return the first day of the quarter for a given ISO date.
 *
 * - Validates input using isValidDate.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainDate string
 * @example startOfQuarterForDate("2024-03-15") // "2024-01-01"
 * @example startOfQuarterForDate("2024-06-15") // "2024-04-01"
 * @example startOfQuarterForDate("2024-09-15") // "2024-07-01"
 * @example startOfQuarterForDate("2024-12-15") // "2024-10-01"
 * @example startOfQuarterForDate("invalid") // ""
 * @returns ISO PlainDate string for the first day of the quarter, or empty string on invalid input
 */
export function startOfQuarterForDate(value: string): string {
  if (!isValidDate(value)) {
    return "";
  }

  try {
    const date = Temporal.PlainDate.from(value);
    const month = date.month;
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;

    return date.with({ month: quarterStartMonth, day: 1 }).toString();
  } catch {
    return "";
  }
}
