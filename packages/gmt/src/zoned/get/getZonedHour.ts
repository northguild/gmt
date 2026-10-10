import { frameNowWallClock, zoneFrame } from "../../internal/zoneFrame";

/**
 * Return the current hour for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or
 *   a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns current hour string (zero-padded to 2 digits) or "" on invalid input
 *
 * @example getZonedHour("America/New_York") // "19"
 * @example getZonedHour("invalid") // ""
 */
export function getZonedHour(ianaTimezone: string): string {
  const frame = zoneFrame(ianaTimezone);

  if (frame === null) return "";

  try {
    return frameNowWallClock(frame).hour.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
