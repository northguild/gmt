import { frameNowWallClock, zoneFrame } from "../../internal/zoneFrame";

/**
 * Return the current day of week for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Returns 1-7 (Monday=1 through Sunday=7).
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or
 *   a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns current day of week number (1-7) or null on invalid input
 *
 * @example getZonedDayOfWeek("America/New_York") // 3
 * @example getZonedDayOfWeek("invalid") // null
 */
export function getZonedDayOfWeek(ianaTimezone: string): number | null {
  const frame = zoneFrame(ianaTimezone);

  if (frame === null) return null;

  try {
    const now = frameNowWallClock(frame);
    return now.dayOfWeek;
  } catch {
    return null;
  }
}
