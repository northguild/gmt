import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current nanosecond from UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 3 digits.
 * - Returns "" on failure.
 *
 * @returns current nanosecond string (zero-padded to 3 digits) or "" on failure
 *
 * @example getUtcNanosecond() // "789"
 * @example getUtcNanosecond() // "" (on failure)
 */
export function getUtcNanosecond(): string {
  try {
    return (Temporal.Now.instant().toZonedDateTimeISO("UTC").nanosecond ?? 0)
      .toString()
      .padStart(3, "0");
  } catch {
    return "";
  }
}
