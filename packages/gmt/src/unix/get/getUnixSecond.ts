import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current second from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 *
 * @returns current second string (zero-padded to 2 digits)
 *
 * @example getUnixSecond() // "45"
 */
export function getUnixSecond(): string {
  return Temporal.Now.instant()
    .toZonedDateTimeISO("UTC")
    .second.toString()
    .padStart(2, "0");
}
