import { frameNowWallClock, zoneFrame } from "../../internal/zoneFrame";

/**
 * Return the current microsecond for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or
 *   a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns current microsecond string (zero-padded to 3 digits) or "" on invalid input
 *
 * @example getZonedMicrosecond("America/New_York") // "000"
 * @example getZonedMicrosecond("invalid") // ""
 */
export function getZonedMicrosecond(ianaTimezone: string): string {
  const frame = zoneFrame(ianaTimezone);

  if (frame === null) return "";

  try {
    return (frameNowWallClock(frame).microsecond ?? 0)
      .toString()
      .padStart(3, "0");
  } catch {
    return "";
  }
}
