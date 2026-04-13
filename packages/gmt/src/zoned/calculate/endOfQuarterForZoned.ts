import { Temporal } from "@js-temporal/polyfill";

import { isValidZonedDateTime } from "../validate";

/**
 * Return the end of the quarter for a given zoned ISO datetime.
 *
 * - Validates input using isValidZonedDateTime.
 * - Returns an empty string for invalid inputs.
 *
 * @param value ISO ZonedDateTime string
 * @returns ISO ZonedDateTime string for the end of the quarter (last moment), or empty string on invalid input
 */
export function endOfQuarterForZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zdt = Temporal.ZonedDateTime.from(value);
    const month = zdt.month;
    const quarterEndMonth = Math.floor((month - 1) / 3) * 3 + 3;

    const quarterStart = zdt.with({
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
