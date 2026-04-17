import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return today's date in the given IANA timeZone as an ISO date string.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get current date in timezone.
 * - Returns "" for invalid timezone.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns ISO date string (YYYY-MM-DD) or "" when invalid
 *
 * @example getZonedToday("America/New_York") // "2024-02-29"
 * @example getZonedToday("invalid") // ""
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
