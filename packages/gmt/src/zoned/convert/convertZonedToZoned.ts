import { isValidTimeZone, isValidZonedDateTime } from "../validate";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Convert a zoned ISO 8601 datetime string to the same instant in a different `timeZone`.
 *
 * - Uses Temporal.ZonedDateTime.withTimeZone to convert.
 * - Returns "" for invalid input.
 * - An offset with seconds (`-00:44:30`) returns `""`. A written zone cannot carry seconds (RFC
 *   9557 §4.1), so the result could not name it. Pass the IANA name, or call
 *   `fromOffsetInstant({ instant, offset })` for the local time with its full offset and no
 *   bracket.
 *
 * @param value zoned ISO 8601 datetime string
 * @param timeZone target IANA name or a UTC offset to the minute (what `isValidTimeZone` accepts)
 * @returns zoned ISO 8601 string in target timeZone or "" when invalid
 *
 * @example convertZonedToZoned("2024-02-29T12:34:56.789+00:00[UTC]", "America/New_York") // "2024-02-29T07:34:56.789-05:00[America/New_York]"
 * @example convertZonedToZoned("invalid", "America/New_York") // ""
 */
export function convertZonedToZoned(value: string, timeZone: string): string {
  if (!isValidZonedDateTime(value) || !isValidTimeZone(timeZone)) {
    return "";
  }

  try {
    const zonedDateTime = zonedDateTimeFrom(value);
    return zonedDateTime.withTimeZone(timeZone).toString();
  } catch {
    return "";
  }
}
