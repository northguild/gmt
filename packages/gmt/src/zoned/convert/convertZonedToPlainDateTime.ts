import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";
import { zonedDateTimeFrom } from "../../internal";

/**
 * Convert a zoned ISO 8601 datetime string to a plain datetime string.
 *
 * - Extracts the local date-time components without timezone info.
 * - Validation is performed on the input.
 * - **The offset is dropped, and with it which occurrence of a repeated wall time was meant.**
 *   In a fall-back overlap the same plain date-time names two instants; converting back with
 *   `convertPlainDateTimeToZoned` picks the earlier one by default. Keep the zoned string, or
 *   pass `{ disambiguation: "later" }` when converting back, to recover the second occurrence.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns plain datetime string or "" on invalid input
 *
 * @example convertZonedToPlainDateTime("2024-02-29T14:30:45.123-05:00[America/New_York]") // "2024-02-29T14:30:45.123"
 * @example convertZonedToPlainDateTime("2024-11-03T01:30:00-05:00[America/New_York]") // "2024-11-03T01:30:00" (the second 01:30, EST)
 * @example convertZonedToPlainDateTime("2024-11-03T01:30:00-04:00[America/New_York]") // "2024-11-03T01:30:00" (the first 01:30, EDT)
 * @example convertZonedToPlainDateTime("invalid") // ""
 */
export function convertZonedToPlainDateTime(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    return zonedDateTimeFrom(value).toPlainDateTime().toString();
  } catch {
    return "";
  }
}
