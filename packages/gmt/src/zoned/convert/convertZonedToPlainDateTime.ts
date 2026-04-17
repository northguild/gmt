import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";

/**
 * Convert a zoned ISO 8601 datetime string to a plain datetime string.
 *
 * - Extracts the local date-time components without timezone info.
 * - Validation is performed on the input.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns plain datetime string or "" on invalid input
 *
 * @example convertZonedToPlainDateTime("2024-02-29T14:30:45.123-05:00[America/New_York]") // "2024-02-29T14:30:45.123"
 * @example convertZonedToPlainDateTime("invalid") // ""
 */
export function convertZonedToPlainDateTime(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    return Temporal.ZonedDateTime.from(value).toPlainDateTime().toString();
  } catch {
    return "";
  }
}
