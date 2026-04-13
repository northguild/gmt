import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return today's date in the given IANA timeZone as an ISO date string.
 *
 * - Uses `Temporal.Now.zonedDateTimeISO(ianaTimezone)` and returns
 *   `toPlainDate().toString()`.
 * - Returns empty string "" for invalid timeZone or on failure.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns ISO date string (YYYY-MM-DD) or empty string when invalid
 */
export function getZonedToday(ianaTimezone: string): string {
  if (!isValidTimeZone(ianaTimezone)) {
    return "";
  }

  try {
    const today = Temporal.Now.zonedDateTimeISO(ianaTimezone).toPlainDate();
    return today.toString();
  } catch {
    return "";
  }
}
