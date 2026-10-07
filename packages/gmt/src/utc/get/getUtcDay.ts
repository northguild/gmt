import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current day from UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 *
 * @returns current day string (zero-padded to 2 digits)
 *
 * @example getUtcDay() // "29"
 */
export function getUtcDay(): string {
  return Temporal.Now.instant()
    .toZonedDateTimeISO("UTC")
    .day.toString()
    .padStart(2, "0");
}
