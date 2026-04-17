import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return the current day of month for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns current day string (zero-padded to 2 digits) or "" on invalid input
 *
 * @example getZonedDay("America/New_York") // "28"
 * @example getZonedDay("invalid") // ""
 */
export function getZonedDay(ianaTimezone: string): string {
  if (!isValidTimeZone(ianaTimezone)) return "";

  try {
    return Temporal.Now.zonedDateTimeISO(ianaTimezone)
      .day.toString()
      .padStart(2, "0");
  } catch {
    return "";
  }
}
