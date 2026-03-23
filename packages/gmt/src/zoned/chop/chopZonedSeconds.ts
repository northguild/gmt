import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";

/**
 * Returns the zoned datetime string truncated to minute precision
 * (removes seconds and milliseconds) from an ISO 8601 zoned datetime input.
 *
 * Notes:
 * - Validates input with `isValidZonedDateTime` first.
 * - Uses `Temporal.ZonedDateTime.prototype.toString({ smallestUnit: 'minute' })`
 *   to drop seconds and sub-second precision.
 *
 * Example:
 * ```ts
 * chopZonedSeconds("2024-02-29T12:30:45.123-05:00[America/New_York]")
 * // => "2024-02-29T12:30-05:00[America/New_York]" (minute precision)
 * ```
 *
 * @param value - ISO 8601 zoned datetime string
 * @returns Zoned datetime string at minute precision or an empty string for invalid input
 */
export function chopZonedSeconds(value: string): string {
  if (!isValidZonedDateTime(value)) return "";
  try {
    return Temporal.ZonedDateTime.from(value).toString({
      smallestUnit: "minute",
    });
  } catch {
    return "";
  }
}
