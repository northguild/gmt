import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current microsecond from UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 3 digits.
 * - Returns "" on failure.
 *
 * @returns current microsecond string (zero-padded to 3 digits) or "" on failure
 *
 * @example getUtcMicrosecond() // "456"
 * @example getUtcMicrosecond() // "" (on failure)
 */
export function getUtcMicrosecond(): string {
  try {
    return (Temporal.Now.instant().toZonedDateTimeISO("UTC").microsecond ?? 0)
      .toString()
      .padStart(3, "0");
  } catch {
    return "";
  }
}
