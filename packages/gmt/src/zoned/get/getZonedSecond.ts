import { frameNowWallClock, zoneFrame } from "../../internal/zoneFrame";

/**
 * Return the current second for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or
 *   a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns current second string (zero-padded to 2 digits) or "" on invalid input
 *
 * @example getZonedSecond("America/New_York") // "00"
 * @example getZonedSecond("invalid") // ""
 */
export function getZonedSecond(ianaTimezone: string): string {
  const frame = zoneFrame(ianaTimezone);

  if (frame === null) return "";

  try {
    return frameNowWallClock(frame).second.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
