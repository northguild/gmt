import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return the current year for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns current year string (zero-padded to 4 digits) or "" on invalid input
 *
 * @example getZonedYear("America/New_York") // "2024"
 * @example getZonedYear("invalid") // ""
 */
export function getZonedYear(ianaTimezone: string): string {
  if (!isValidTimeZone(ianaTimezone)) return "";

  try {
    return Temporal.Now.zonedDateTimeISO(ianaTimezone)
      .year.toString()
      .padStart(4, "0");
  } catch {
    return "";
  }
}
