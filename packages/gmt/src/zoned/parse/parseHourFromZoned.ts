import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the hour (0-23) from a zoned datetime string.
 *
 * - Returns zero-padded string for hour.
 * - Returns "" for invalid input.
 *
 * @param value ISO zoned datetime string (e.g., "2024-03-15T14:30:45.123+00:00[UTC]")
 * @returns Hour (00-23) or "" on invalid input
 *
 * @example parseHourFromZoned("2024-03-15T14:30:45+00:00[UTC]") // "14"
 * @example parseHourFromZoned("invalid") // ""
 */
export function parseHourFromZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.hour.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
