import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";

/**
 * Extracts the local time portion from an ISO 8601 zoned datetime string.
 *
 * - Extracts time components (hour, minute, second, subsecond) from a ZonedDateTime.
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @returns The local time portion as HH:MM:SS(.SSS) or "" for invalid
 *
 * @example chopZonedDate("2024-02-29T14:30:45.123-05:00[America/New_York]") // "14:30:45.123"
 * @example chopZonedDate("invalid") // ""
 */
export function chopZonedDate(value: string): string {
  if (!isValidZonedDateTime(value)) return "";
  try {
    return Temporal.ZonedDateTime.from(value).toPlainTime().toString();
  } catch {
    return "";
  }
}
