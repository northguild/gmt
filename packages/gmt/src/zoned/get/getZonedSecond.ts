import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return the current second for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns current second string (zero-padded to 2 digits) or "" on invalid input
 *
 * @example getZonedSecond("America/New_York") // "00"
 * @example getZonedSecond("invalid") // ""
 */
export function getZonedSecond(ianaTimezone: string): string {
  if (!isValidTimeZone(ianaTimezone)) return "";

  try {
    return Temporal.Now.zonedDateTimeISO(ianaTimezone)
      .second.toString()
      .padStart(2, "0");
  } catch {
    return "";
  }
}
