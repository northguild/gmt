import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { isoYearString } from "../../internal/isoYearString";

/**
 * Return the current year as a zero-padded string in the system timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get current year in system timezone.
 * - Returns zero-padded string (e.g., "2024").
 * - A year outside 0000–9999 is written with a sign and six digits (`+010000`, `-000005`), as
 *   Temporal writes it at the head of a date.
 * - Returns "" when system timezone is unavailable.
 *
 * @returns current year string (zero-padded) or "" on invalid
 *
 * @example getYear() // "2024"
 * @example getYear() // "" (when system timeZone unavailable)
 */
export function getYear(): string {
  const timeZone = getSystemTimeZone();
  if (!timeZone) return "";

  try {
    return isoYearString(Temporal.Now.zonedDateTimeISO(timeZone).year);
  } catch {
    return "";
  }
}
