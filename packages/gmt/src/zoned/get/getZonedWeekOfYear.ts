import { frameNowWallClock, zoneFrame } from "../../internal/zoneFrame";

/**
 * Return the current week of year for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Uses Temporal.PlainDate.weekOfYear for ISO week number.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or
 *   a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns current week number (1-53) or null on invalid input
 *
 * @example getZonedWeekOfYear("America/New_York") // 9
 * @example getZonedWeekOfYear("invalid") // null
 */
export function getZonedWeekOfYear(ianaTimezone: string): number | null {
  const frame = zoneFrame(ianaTimezone);

  if (frame === null) return null;

  try {
    const now = frameNowWallClock(frame);
    return now.toPlainDate().weekOfYear ?? null;
  } catch {
    return null;
  }
}
