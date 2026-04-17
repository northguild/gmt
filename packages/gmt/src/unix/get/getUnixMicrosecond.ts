import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current microsecond from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 3 digits.
 * - Returns "" on failure.
 *
 * @returns current microsecond string (zero-padded to 3 digits) or "" on failure
 *
 * @example getUnixMicrosecond() // "456"
 * @example getUnixMicrosecond() // "" (on failure)
 */
export function getUnixMicrosecond(): string {
  try {
    return (Temporal.Now.instant().toZonedDateTimeISO("UTC").microsecond ?? 0)
      .toString()
      .padStart(3, "0");
  } catch {
    return "";
  }
}
