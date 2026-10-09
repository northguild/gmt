import { frameNowWallClock, zoneFrame } from "../../internal/zoneFrame";
import { isoYearString } from "../../internal/isoYearString";

/**
 * Return the current year for the specified IANA timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Validation is performed on the timezone.
 * - The year is zero-padded to 4 digits. A year outside 0000–9999 is written with a sign and six
 *   digits (`+010000`, `-000005`), as Temporal writes it at the head of a date.
 *
 * @param ianaTimezone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or
 *   a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns current year string (zero-padded to 4 digits) or "" on invalid input
 *
 * @example getZonedYear("America/New_York") // "2024"
 * @example getZonedYear("invalid") // ""
 */
export function getZonedYear(ianaTimezone: string): string {
  const frame = zoneFrame(ianaTimezone);

  if (frame === null) return "";

  try {
    return isoYearString(frameNowWallClock(frame).year);
  } catch {
    return "";
  }
}
