import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current month from the Unix timestamp in UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 * - Returns "" on failure.
 *
 * @returns current month string (zero-padded to 2 digits) or "" on failure
 *
 * @example getUnixMonth() // "02"
 * @example getUnixMonth() // "" (on failure)
 */
export function getUnixMonth(): string {
  try {
    return Temporal.Now.instant()
      .toZonedDateTimeISO("UTC")
      .month.toString()
      .padStart(2, "0");
  } catch {
    return "";
  }
}
