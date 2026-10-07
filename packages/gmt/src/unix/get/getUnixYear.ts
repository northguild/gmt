import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current year from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 4 digits.
 *
 * @returns current year string (zero-padded to 4 digits)
 *
 * @example getUnixYear() // "2024"
 */
export function getUnixYear(): string {
  return Temporal.Now.instant()
    .toZonedDateTimeISO("UTC")
    .year.toString()
    .padStart(4, "0");
}
