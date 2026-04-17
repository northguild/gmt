import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the minute (0-59) from a zoned datetime string.
 *
 * - Returns zero-padded string for minute.
 * - Returns "" for invalid input.
 *
 * @param value ISO zoned datetime string (e.g., "2024-03-15T14:30:45.123+00:00[UTC]")
 * @returns Minute (00-59) or "" on invalid input
 *
 * @example parseMinuteFromZoned("2024-03-15T14:30:45+00:00[UTC]") // "30"
 * @example parseMinuteFromZoned("invalid") // ""
 */
export function parseMinuteFromZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.minute.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
