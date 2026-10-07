import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current nanosecond from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 3 digits.
 *
 * @returns current nanosecond string (zero-padded to 3 digits)
 *
 * @example getUnixNanosecond() // "789"
 */
export function getUnixNanosecond(): string {
  return (Temporal.Now.instant().toZonedDateTimeISO("UTC").nanosecond ?? 0)
    .toString()
    .padStart(3, "0");
}
