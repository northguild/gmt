import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the number of hours in the calendar day a zoned datetime falls on.
 *
 * - Accounts for DST transitions: a spring-forward day is 23 hours, a fall-back
 *   day is 25 hours, and a normal day is 24 hours. Zones whose DST shift isn't
 *   a whole hour (e.g. `Australia/Lord_Howe`'s 30-minute shift) return a
 *   fractional value instead, such as 23.5 or 24.5.
 * - The calculation is based on the local calendar day of the input, not the
 *   UTC instant.
 * - Returns null for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns number of hours in the day (usually 23, 24, or 25; fractional for
 *   non-whole-hour DST shifts), or null on invalid input
 *
 * @example getHoursInZonedDay("2024-03-10T12:00:00-04:00[America/New_York]") // 23
 * @example getHoursInZonedDay("2024-11-03T12:00:00-05:00[America/New_York]") // 25
 * @example getHoursInZonedDay("2024-02-29T12:00:00+00:00[UTC]")              // 24
 * @example getHoursInZonedDay("2024-10-06T12:00:00+11:00[Australia/Lord_Howe]") // 23.5
 * @example getHoursInZonedDay("invalid")                                      // null
 */
export function getHoursInZonedDay(value: string): number | null {
  if (!isValidZonedDateTime(value)) {
    return null;
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    const startOfDay = zonedDateTime.with({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    });
    const nextDay = startOfDay.add({ days: 1 });
    const duration = startOfDay.until(nextDay);
    return duration.total({ unit: "hours" });
  } catch {
    return null;
  }
}
