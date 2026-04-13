import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return the current zoned datetime for the specified IANA timeZone.
 *
 * - Uses `Temporal.Now.zonedDateTimeISO(ianaTimezone)`.
 * - Returns empty string "" for invalid timeZone or on failure.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns zoned ISO 8601 datetime string or empty string when invalid
 */
export function getZonedNow(ianaTimezone: string): string {
  if (!isValidTimeZone(ianaTimezone)) {
    return "";
  }

  try {
    const now = Temporal.Now.zonedDateTimeISO(ianaTimezone);
    return now.toString();
  } catch {
    return "";
  }
}
