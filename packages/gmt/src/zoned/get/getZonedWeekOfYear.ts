import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../validate";

/**
 * Return the current week of year for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Uses Temporal.PlainDate.weekOfYear for ISO week number.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @returns current week number (1-53) or null on invalid input
 *
 * @example getZonedWeekOfYear("America/New_York") // 9
 * @example getZonedWeekOfYear("invalid") // null
 */
export function getZonedWeekOfYear(ianaTimezone: string): number | null {
  if (!isValidTimeZone(ianaTimezone)) return null;

  try {
    const now = Temporal.Now.zonedDateTimeISO(ianaTimezone);
    return now.toPlainDate().weekOfYear ?? null;
  } catch {
    return null;
  }
}
