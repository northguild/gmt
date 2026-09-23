import { Temporal } from "@js-temporal/polyfill";
import { resolveReadingTimeZone } from "../../internal/resolveReadingTimeZone";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the day of week (1-7) from a UTC datetime string.
 *
 * - Monday=1 through Sunday=7.
 * - Reads the value on the wall clock of `options.timeZone` (an IANA zone, default UTC), as
 *   `parseTimeFromUtc` does; an invalid zone returns null.
 * - Returns null for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options optional: timeZone (IANA, default "UTC")
 * @returns Day of week (1-7) or null on invalid input
 *
 * @example parseDayOfWeekFromUtc("2024-03-17T14:30:45Z") // 7
 * @example parseDayOfWeekFromUtc("2024-03-18T00:00:00Z") // 1
 * @example parseDayOfWeekFromUtc("2024-03-17T02:30:45Z", { timeZone: "America/New_York" }) // 6 (Saturday in New York)
 * @example parseDayOfWeekFromUtc("invalid") // null
 */
export function parseDayOfWeekFromUtc(
  value: string,
  options?: { timeZone?: string },
): number | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    if (!isValidUtc(value)) return null;

    const timeZone = resolveReadingTimeZone(options?.timeZone);
    if (timeZone === null) return null;

    try {
      const dateTime = Temporal.Instant.from(value).toZonedDateTimeISO(timeZone);
      return dateTime.dayOfWeek;
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
