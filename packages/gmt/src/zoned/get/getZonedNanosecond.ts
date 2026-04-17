import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return the current nanosecond for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns current nanosecond string (zero-padded to 3 digits) or "" on invalid input
 *
 * @example getZonedNanosecond("America/New_York") // "000"
 * @example getZonedNanosecond("invalid") // ""
 */
export function getZonedNanosecond(ianaTimezone: string): string {
  if (!isValidTimeZone(ianaTimezone)) return "";

  try {
    return (Temporal.Now.zonedDateTimeISO(ianaTimezone).nanosecond ?? 0)
      .toString()
      .padStart(3, "0");
  } catch {
    return "";
  }
}
