import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the second (0-59) from a zoned datetime string.
 *
 * - Returns zero-padded string for second.
 * - Returns "" for invalid input.
 *
 * @param value ISO zoned datetime string (e.g., "2024-03-15T14:30:45.123+00:00[UTC]")
 * @returns Second (00-59) or "" on invalid input
 *
 * @example parseSecondFromZoned("2024-03-15T14:30:45+00:00[UTC]") // "45"
 * @example parseSecondFromZoned("invalid") // ""
 */
export function parseSecondFromZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.second.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
