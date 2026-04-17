import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the millisecond (0-999) from a zoned datetime string.
 *
 * - Returns zero-padded string for millisecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO zoned datetime string (e.g., "2024-03-15T14:30:45.123+00:00[UTC]")
 * @returns Millisecond (000-999) or "" on invalid input
 *
 * @example parseMillisecondFromZoned("2024-03-15T14:30:45.123+00:00[UTC]") // "123"
 * @example parseMillisecondFromZoned("invalid") // ""
 */
export function parseMillisecondFromZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.millisecond.toString().padStart(3, "0");
  } catch {
    return "";
  }
}
