import { frameNowWallClock, zoneFrame } from "../../internal/zoneFrame";

/**
 * Return the current nanosecond for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 *
 * @param ianaTimezone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or
 *   a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns current nanosecond string (zero-padded to 3 digits) or "" on invalid input
 *
 * @example getZonedNanosecond("America/New_York") // "000"
 * @example getZonedNanosecond("invalid") // ""
 */
export function getZonedNanosecond(ianaTimezone: string): string {
  const frame = zoneFrame(ianaTimezone);

  if (frame === null) return "";

  try {
    return (frameNowWallClock(frame).nanosecond ?? 0)
      .toString()
      .padStart(3, "0");
  } catch {
    return "";
  }
}
