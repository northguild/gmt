import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";

/**
 * Extracts the local time portion from an ISO 8601 zoned datetime string.
 *
 * Notes:
 * - The function first validates the input using `isValidZonedDateTime` (this
 *   also guards against leap-second strings). If validation fails an empty
 *   string is returned.
 * - On success the function parses the value with `Temporal.ZonedDateTime`
 *   and returns the localized time portion produced by
 *   `toPlainTime().toString()`.
 *
 * Example:
 * ```ts
 * chopZonedDate("2024-02-29T14:30:45.123-05:00[America/New_York]")
 * // => "14:30:45.123"
 * ```
 *
 * @param value - ISO 8601 zoned datetime string (e.g. `2024-02-29T12:00:00+00:00[UTC]`).
 * @returns The local time portion as `HH:MM:SS(.SSS)` or an empty string for invalid input.
 */
export function chopZonedDate(value: string): string {
  if (!isValidZonedDateTime(value)) return "";
  try {
    return Temporal.ZonedDateTime.from(value).toPlainTime().toString();
  } catch {
    return "";
  }
}
