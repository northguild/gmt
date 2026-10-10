import { frameNowWallClock, zoneFrame } from "../../internal/zoneFrame";

/**
 * Return the current millisecond for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or
 *   a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns current millisecond string (zero-padded to 3 digits) or "" on invalid input
 *
 * @example getZonedMillisecond("America/New_York") // "000"
 * @example getZonedMillisecond("invalid") // ""
 */
export function getZonedMillisecond(ianaTimezone: string): string {
  const frame = zoneFrame(ianaTimezone);

  if (frame === null) return "";

  try {
    return frameNowWallClock(frame).millisecond.toString().padStart(3, "0");
  } catch {
    return "";
  }
}
