import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the day (1-31) from a zoned datetime string.
 *
 * - Returns zero-padded string for day.
 * - Returns "" for invalid input.
 *
 * @param value ISO zoned datetime string (e.g., "2024-03-15T14:30:45.123+00:00[UTC]")
 * @returns Day (01-31) or "" on invalid input
 *
 * @example parseDayFromZoned("2024-03-15T14:30:45+00:00[UTC]") // "15"
 * @example parseDayFromZoned("invalid") // ""
 */
export function parseDayFromZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.day.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
