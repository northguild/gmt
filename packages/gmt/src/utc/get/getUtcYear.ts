import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current year from UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 4 digits.
 *
 * @returns current year string (zero-padded to 4 digits)
 *
 * @example getUtcYear() // "2024"
 */
export function getUtcYear(): string {
  return Temporal.Now.instant()
    .toZonedDateTimeISO("UTC")
    .year.toString()
    .padStart(4, "0");
}
