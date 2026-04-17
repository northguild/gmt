import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return the last day of the quarter for a given ISO date.
 *
 * - Returns the last day of the quarter containing the input date.
 * - Q1 ends on "03-31", Q2 ends on "06-30", Q3 ends on "09-30", Q4 ends on "12-31".
 * - Validates input using isValidDate.
 *
 * @param value ISO PlainDate string
 * @returns ISO PlainDate string for the last day of the quarter, or "" on invalid input
 *
 * @example endOfQuarterForDate("2024-03-15") // "2024-03-31"
 * @example endOfQuarterForDate("2024-06-15") // "2024-06-30"
 * @example endOfQuarterForDate("2024-09-15") // "2024-09-30"
 * @example endOfQuarterForDate("2024-12-15") // "2024-12-31"
 * @example endOfQuarterForDate("invalid") // ""
 */
export function endOfQuarterForDate(value: string): string {
  if (!isValidDate(value)) {
    return "";
  }

  try {
    const date = Temporal.PlainDate.from(value);
    const month = date.month;
    const quarterEndMonth = Math.floor((month - 1) / 3) * 3 + 3;

    const quarterStart = date.with({ month: quarterEndMonth, day: 1 });
    const nextQuarterStart = quarterStart.add({ months: 1 });
    return nextQuarterStart.subtract({ days: 1 }).toString();
  } catch {
    return "";
  }
}
