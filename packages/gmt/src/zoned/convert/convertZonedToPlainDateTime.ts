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
 * @example convertZonedToPlainDateTime("2024-02-29T14:30:45.123-03:00[America/Sao_Paulo]") // "2024-02-29T14:30:45.123"
 * @example convertZonedToPlainDateTime("2024-10-27T01:30:00+00:00[Europe/London]") // "2024-10-27T01:30:00" (the second 01:30, GMT)
 * @example convertZonedToPlainDateTime("2024-10-27T01:30:00+01:00[Europe/London]") // "2024-10-27T01:30:00" (the first 01:30, BST)
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
