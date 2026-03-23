import { Temporal } from "@js-temporal/polyfill";
import { isValidTimezone, isValidZonedDateTime } from "../validate";

/**
 * Convert a zoned ISO 8601 datetime string to the same instant in a
 * different `timeZone`.
 *
 * - Returns an empty string "" for invalid inputs.
 *
 * @param value zoned ISO 8601 datetime string
 * @param timeZone target IANA timezone identifier
 * @returns zoned ISO 8601 string in target timezone or empty string when invalid
 */
export function convertZonedToZoned(value: string, timeZone: string): string {
  if (!isValidZonedDateTime(value) || !isValidTimezone(timeZone)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.withTimeZone(timeZone).toString();
  } catch {
    return "";
  }
}
