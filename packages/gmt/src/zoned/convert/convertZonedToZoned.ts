import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone, isValidZonedDateTime } from "../validate";

/**
 * Convert a zoned ISO 8601 datetime string to the same instant in a different `timeZone`.
 *
 * - Uses Temporal.ZonedDateTime.withTimeZone to convert.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param timeZone target IANA timeZone identifier
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
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.withTimeZone(timeZone).toString();
  } catch {
    return "";
  }
}
