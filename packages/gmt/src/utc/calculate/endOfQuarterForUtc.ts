import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Return the end of the quarter for a given UTC Instant string.
 *
 * - Calculates quarter end month: Q1=3, Q2=6, Q3=9, Q4=12.
 * - Returns last moment of the quarter.
 * - Returns "" for invalid input.
 *
 * @param value UTC Instant string
 * @returns UTC Instant string for the end of the quarter, or "" on invalid input
 *
 * @example endOfQuarterForUtc("2024-03-15T12:00:00Z") // "2024-03-31T23:59:59.999Z"
 * @example endOfQuarterForUtc("invalid") // ""
 */
export function endOfQuarterForUtc(value: string): string {
  if (!isValidUtc(value)) {
    return "";
  }

  try {
    const instant = Temporal.Instant.from(value);
    const zdt = instant.toZonedDateTimeISO("UTC");
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

    const result = lastDayOfQuarter
      .with({
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
        microsecond: 999,
        nanosecond: 999,
      })
      .toInstant();

    return result.toString();
  } catch {
    return "";
  }
}
