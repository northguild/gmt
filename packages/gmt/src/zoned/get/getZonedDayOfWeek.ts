import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return the current day of week for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Returns 1-7 (Monday=1 through Sunday=7).
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns current day of week number (1-7) or null on invalid input
 *
 * @example getZonedDayOfWeek("America/New_York") // 3
 * @example getZonedDayOfWeek("invalid") // null
 */
export function getZonedDayOfWeek(ianaTimezone: string): number | null {
  if (!isValidTimeZone(ianaTimezone)) return null;

  try {
    const now = Temporal.Now.zonedDateTimeISO(ianaTimezone);
    return now.dayOfWeek;
  } catch {
    return null;
  }
}
