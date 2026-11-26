import { zonedDateTimeOf } from "../../internal/zonedWallClock";

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
  const zonedDateTime = zonedDateTimeOf(value);
  if (zonedDateTime === null) {
    return "";
  }

  try {
    return zonedDateTime.month.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
