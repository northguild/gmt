import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

/**
 * Return the start of the quarter for a given ISO datetime.
 *
 * - Returns the first day of the quarter with time set to 00:00:00.
 * - Q1 returns "01-01T00:00:00", Q2 returns "04-01T00:00:00", etc.
 * - Validates input using isValidDateTime.
 *
 * @param value ISO PlainDateTime string
 * @returns ISO PlainDateTime string for the start of the quarter, or "" on invalid input
 *
 * @example startOfQuarterForDateTime("2024-03-15T12:00:00") // "2024-01-01T00:00:00"
 * @example startOfQuarterForDateTime("2024-06-15T12:00:00") // "2024-04-01T00:00:00"
 * @example startOfQuarterForDateTime("invalid") // ""
 */
export function startOfQuarterForDateTime(value: string): string {
  if (!isValidDateTime(value)) {
    return "";
  }

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    const month = dateTime.month;
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;

    return dateTime
      .with({ month: quarterStartMonth, day: 1, hour: 0, minute: 0, second: 0 })
      .toString();
  } catch {
    return "";
  }
}
