import { frameNowWallClock, zoneFrame } from "../../internal/zoneFrame";

/**
 * Return the current minute for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or
 *   a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns current minute string (zero-padded to 2 digits) or "" on invalid input
 *
 * @example getZonedMinute("America/New_York") // "00"
 * @example getZonedMinute("invalid") // ""
 */
export function getZonedMinute(ianaTimezone: string): string {
  const frame = zoneFrame(ianaTimezone);

  if (frame === null) return "";

  try {
    return frameNowWallClock(frame).minute.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
