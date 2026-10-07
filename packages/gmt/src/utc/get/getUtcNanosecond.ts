import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current nanosecond from UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 3 digits.
 *
 * @returns current nanosecond string (zero-padded to 3 digits)
 *
 * @example getUtcNanosecond() // "789"
 */
export function getUtcNanosecond(): string {
  return (Temporal.Now.instant().toZonedDateTimeISO("UTC").nanosecond ?? 0)
    .toString()
    .padStart(3, "0");
}
