import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone, isValidZonedDateTime } from "../validate";

/**
 * Convert a zoned ISO 8601 datetime string to the same instant in a
 * different `timeZone`.
 *
 * - Returns an empty string "" for invalid inputs.
 *
 * @param value zoned ISO 8601 datetime string
 * @param timeZone target IANA timeZone identifier
 * @returns zoned ISO 8601 string in target timeZone or empty string when invalid
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
