import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return the current month for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns current month string (zero-padded to 2 digits) or "" on invalid input
 *
 * @example getZonedMonth("America/New_York") // "02"
 * @example getZonedMonth("invalid") // ""
 */
export function getZonedMonth(ianaTimezone: string): string {
  if (!isValidTimeZone(ianaTimezone)) return "";

  try {
    return Temporal.Now.zonedDateTimeISO(ianaTimezone)
      .month.toString()
      .padStart(2, "0");
  } catch {
    return "";
  }
}
