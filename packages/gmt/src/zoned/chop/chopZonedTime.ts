import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";

/**
 * Extracts the local date portion from an ISO 8601 zoned datetime string.
 *
 * Notes:
 * - Validates the input with `isValidZonedDateTime` (guards against leap-second strings).
 * - Returns the local date as `YYYY-MM-DD` via `toPlainDate().toString()`.
 *
 * Example:
 * ```ts
 * chopZonedTime("2024-02-29T14:30:45.123-05:00[America/New_York]")
 * // => "2024-02-29"
 * ```
 *
 * @param value - ISO 8601 zoned datetime string
 * @returns Local date string `YYYY-MM-DD` or an empty string for invalid input
 */
export function chopZonedTime(value: string): string {
  if (!isValidZonedDateTime(value)) return "";
  try {
    return Temporal.ZonedDateTime.from(value).toPlainDate().toString();
  } catch {
    return "";
  }
}
