import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current month from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 *
 * @returns current month string (zero-padded to 2 digits)
 *
 * @example getUnixMonth() // "02"
 */
export function getUnixMonth(): string {
  return Temporal.Now.instant()
    .toZonedDateTimeISO("UTC")
    .month.toString()
    .padStart(2, "0");
}
