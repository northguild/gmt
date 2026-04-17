import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the month (1-12) from a zoned datetime string.
 *
 * - Returns zero-padded string for month.
 * - Returns "" for invalid input.
 *
 * @param value ISO zoned datetime string (e.g., "2024-03-15T14:30:45.123+00:00[UTC]")
 * @returns Month (01-12) or "" on invalid input
 *
 * @example parseMonthFromZoned("2024-03-15T14:30:45+00:00[UTC]") // "03"
 * @example parseMonthFromZoned("invalid") // ""
 */
export function parseMonthFromZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.month.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
