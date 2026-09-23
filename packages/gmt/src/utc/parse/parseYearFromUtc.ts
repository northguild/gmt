import { utcZonedDateTime } from "../../internal/utcZonedDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the year from a UTC datetime string.
 *
 * - Returns the year as a string (e.g., "2024").
 * - Reads the value on the wall clock of `options.timeZone` (an IANA zone, default UTC), as
 *   `parseTimeFromUtc` does; an invalid zone returns "".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options optional: timeZone (IANA, default "UTC")
 * @returns Year (YYYY) or "" on invalid input
 *
 * @example parseYearFromUtc("2024-03-17T14:30:45Z") // "2024"
 * @example parseYearFromUtc("2025-01-01T02:00:00Z", { timeZone: "America/New_York" }) // "2024"
 * @example parseYearFromUtc("invalid") // ""
 */
export function parseYearFromUtc(
  value: string,
  options?: { timeZone?: string },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    const dateTime = utcZonedDateTime(value, options);

    return dateTime === null ? "" : dateTime.year.toString();
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
