import { frameNowWallClock, zoneFrame } from "../../internal/zoneFrame";

/**
 * Return today's date in the given IANA timeZone as an ISO date string.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get current date in timezone.
 * - Returns "" for invalid timezone.
 *
 * @param ianaTimezone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or
 *   a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns ISO date string (YYYY-MM-DD) or "" when invalid
 *
 * @example getZonedToday("America/New_York") // "2024-02-29"
 * @example getZonedToday("invalid") // ""
 */
export function getZonedToday(ianaTimezone: string): string {
  const frame = zoneFrame(ianaTimezone);

  if (frame === null) {
    return "";
  }

  try {
    const today = frameNowWallClock(frame).toPlainDate();
    return today.toString();
  } catch {
    return "";
  }
}
