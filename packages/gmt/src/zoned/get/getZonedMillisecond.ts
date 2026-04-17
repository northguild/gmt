import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return the current millisecond for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns current millisecond string (zero-padded to 3 digits) or "" on invalid input
 *
 * @example getZonedMillisecond("America/New_York") // "000"
 * @example getZonedMillisecond("invalid") // ""
 */
export function getZonedMillisecond(ianaTimezone: string): string {
  if (!isValidTimeZone(ianaTimezone)) return "";

  try {
    return Temporal.Now.zonedDateTimeISO(ianaTimezone)
      .millisecond.toString()
      .padStart(3, "0");
  } catch {
    return "";
  }
}
