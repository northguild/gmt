import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

/**
 * Return the start of the quarter for a given ISO datetime.
 *
 * - Validates input using isValidDateTime.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO PlainDateTime string
 * @example startOfQuarterForDateTime("2024-03-15T12:00:00") // "2024-01-01T00:00:00"
 * @example startOfQuarterForDateTime("2024-06-15T12:00:00") // "2024-04-01T00:00:00"
 * @example startOfQuarterForDateTime("invalid") // ""
 * @returns ISO PlainDateTime string for the start of the quarter, or empty string on invalid input
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
