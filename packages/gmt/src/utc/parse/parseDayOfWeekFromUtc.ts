import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return the day of week (1-7) from a UTC datetime string.
 *
 * - Monday=1 through Sunday=7.
 * - Returns null for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @returns Day of week (1-7) or null on invalid input
 *
 * @example parseDayOfWeekFromUtc("2024-03-17T14:30:45Z") // 7
 * @example parseDayOfWeekFromUtc("2024-03-18T00:00:00Z") // 1
 * @example parseDayOfWeekFromUtc("invalid") // null
 */
export function parseDayOfWeekFromUtc(value: string): number | null {
  if (!isValidUtc(value)) return null;

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");
    return dateTime.dayOfWeek;
  } catch {
    return null;
  }
}
