import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the day of week (1-7) for a given ISO 8601 datetime string.
 *
 * - Monday=1 through Sunday=7.
 * - Returns null for invalid input.
 *
 * @param value ISO datetime string
 * @returns Day of week (1-7) or null on invalid input
 *
 * @example parseDayOfWeekFromDateTime("2024-01-01T12:00:00") // 1 (Monday)
 * @example parseDayOfWeekFromDateTime("2024-01-07T00:00:00") // 7 (Sunday)
 * @example parseDayOfWeekFromDateTime("invalid") // null
 */
export function parseDayOfWeekFromDateTime(value: string): number | null {
  if (!isValidDateTime(value)) {
    return null;
  }

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime.dayOfWeek;
  } catch {
    return null;
  }
}
