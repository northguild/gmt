import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

/**
 * Return the end of the quarter for a given ISO datetime.
 *
 * - Returns the last moment of the quarter with time set to 23:59:59.999999999.
 * - Q1 ends on "03-31T23:59:59.999999999", Q2 ends on "06-30T23:59:59.999999999", etc.
 * - Validates input using isValidDateTime.
 *
 * @param value ISO PlainDateTime string
 * @returns ISO PlainDateTime string for the end of the quarter, or "" on invalid input
 *
 * @example endOfQuarterForDateTime("2024-03-15T12:00:00") // "2024-03-31T23:59:59.999999999"
 * @example endOfQuarterForDateTime("2024-06-15T12:00:00") // "2024-06-30T23:59:59.999999999"
 * @example endOfQuarterForDateTime("invalid") // ""
 */
export function endOfQuarterForDateTime(value: string): string {
  if (!isValidDateTime(value)) {
    return "";
  }

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    const month = dateTime.month;
    const quarterEndMonth = Math.floor((month - 1) / 3) * 3 + 3;

    const quarterStart = dateTime.with({
      month: quarterEndMonth,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    });
    const nextQuarterStart = quarterStart.add({ months: 1 });
    const lastDayOfQuarter = nextQuarterStart.subtract({ days: 1 });

    return lastDayOfQuarter
      .with({
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
        microsecond: 999,
        nanosecond: 999,
      })
      .toString();
  } catch {
    return "";
  }
}
