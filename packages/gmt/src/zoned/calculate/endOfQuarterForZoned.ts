import { Temporal } from "@js-temporal/polyfill";

import { isValidZonedDateTime } from "../validate";

/**
 * Return the end of the quarter for a given zoned ISO datetime.
 *
 * - Calculates which quarter (1-4) the date falls into and returns the last moment of that quarter.
 * - Returns the last nanosecond of the last day of the quarter.
 * - Validation is performed on the input.
 *
 * @param value ISO ZonedDateTime string
 * @returns ISO ZonedDateTime string for the end of the quarter, or "" on invalid input
 *
 * @example endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]") // "2024-03-31T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("2024-05-10T10:00:00+00:00[UTC]") // "2024-06-30T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("2024-11-20T08:00:00+00:00[UTC]") // "2024-12-31T23:59:59.999999999+00:00[UTC]"
 * @example endOfQuarterForZoned("invalid") // ""
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
