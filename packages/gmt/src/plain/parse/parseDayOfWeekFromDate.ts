import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

/**
 * Return the day of week (1-7) for a given ISO 8601 date string.
 *
 * - Monday=1 through Sunday=7.
 * - Returns null for invalid input.
 *
 * @param value ISO date string
 * @returns Day of week (1-7) or null on invalid input
 *
 * @example parseDayOfWeekFromDate("2024-01-01") // 1 (Monday)
 * @example parseDayOfWeekFromDate("2024-01-07") // 7 (Sunday)
 * @example parseDayOfWeekFromDate("2024-01-08") // 1 (Monday)
 * @example parseDayOfWeekFromDate("invalid") // null
 */
export function parseDayOfWeekFromDate(value: string): number | null {
  if (!isValidDate(value)) {
    return null;
  }

  try {
    const date = Temporal.PlainDate.from(value);
    return date.dayOfWeek;
  } catch {
    return null;
  }
}
