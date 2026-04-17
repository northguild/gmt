import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return the current microsecond for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns current microsecond string (zero-padded to 3 digits) or "" on invalid input
 *
 * @example getZonedMicrosecond("America/New_York") // "000"
 * @example getZonedMicrosecond("invalid") // ""
 */
export function getZonedMicrosecond(ianaTimezone: string): string {
  if (!isValidTimeZone(ianaTimezone)) return "";

  try {
    return (Temporal.Now.zonedDateTimeISO(ianaTimezone).microsecond ?? 0)
      .toString()
      .padStart(3, "0");
  } catch {
    return "";
  }
}
