import { zonedDateTimeOf } from "../../internal/zonedWallClock";

/**
 * Return the day of the week (1-7, Monday-Sunday) from a zoned datetime string.
 *
 * - Returns number 1-7 for valid input.
 * - Monday=1 through Sunday=7.
 * - Returns null for invalid input.
 *
 * @param value ISO zoned datetime string (e.g., "2024-03-15T14:30:45.123+00:00[UTC]")
 * @returns Day of week (1-7) or null on invalid input
 *
 * @example parseDayOfWeekFromZoned("2024-03-15T14:30:45+00:00[UTC]") // 5 (Friday)
 * @example parseDayOfWeekFromZoned("invalid") // null
 */
export function parseDayOfWeekFromZoned(value: string): number | null {
  const zonedDateTime = zonedDateTimeOf(value);
  if (zonedDateTime === null) {
    return null;
  }

  try {
    return zonedDateTime.dayOfWeek;
  } catch {
    return null;
  }
}
