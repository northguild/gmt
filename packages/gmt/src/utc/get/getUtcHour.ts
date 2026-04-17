import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current hour from UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 * - Returns "" on failure.
 *
 * @returns current hour string (zero-padded to 2 digits) or "" on failure
 *
 * @example getUtcHour() // "00"
 * @example getUtcHour() // "" (on failure)
 */
export function getUtcHour(): string {
  try {
    return Temporal.Now.instant()
      .toZonedDateTimeISO("UTC")
      .hour.toString()
      .padStart(2, "0");
  } catch {
    return "";
  }
}
