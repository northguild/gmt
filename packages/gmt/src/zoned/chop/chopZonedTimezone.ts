import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";

/**
 * Returns the local plain datetime (date + time) extracted from a zoned datetime string.
 *
 * Notes:
 * - Validates input with `isValidZonedDateTime` before parsing.
 * - Produces a string like `YYYY-MM-DDTHH:MM:SS(.SSS)` by calling
 *   `toPlainDateTime().toString()` on the parsed `Temporal.ZonedDateTime`.
 *
 * Example:
 * ```ts
 * chopZonedTimezone("2024-02-29T14:30:45.123-05:00[America/New_York]")
 * // => "2024-02-29T14:30:45.123"
 * ```
 *
 * @param value - ISO 8601 zoned datetime string
 * @returns Local plain datetime string or an empty string for invalid input
 */
export function chopZonedTimezone(value: string): string {
  if (!isValidZonedDateTime(value)) return "";
  try {
    return Temporal.ZonedDateTime.from(value).toPlainDateTime().toString();
  } catch {
    return "";
  }
}
