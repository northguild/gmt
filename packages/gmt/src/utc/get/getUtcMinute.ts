import { Temporal } from "@js-temporal/polyfill";

/**
 * Return the current minute from UTC as a zero-padded string.
 *
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns zero-padded string to 2 digits.
 * - Returns "" on failure.
 *
 * @returns current minute string (zero-padded to 2 digits) or "" on failure
 *
 * @example getUtcMinute() // "30"
 * @example getUtcMinute() // "" (on failure)
 */
export function getUtcMinute(): string {
  try {
    return Temporal.Now.instant()
      .toZonedDateTimeISO("UTC")
      .minute.toString()
      .padStart(2, "0");
  } catch {
    return "";
  }
}
