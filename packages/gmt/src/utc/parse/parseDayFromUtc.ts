import { utcZonedDateTime } from "../../internal/utcZonedDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the day of month (1-31) from a UTC datetime string.
 *
 * - Returns zero-padded string for day.
 * - Reads the value on the wall clock of `options.timeZone` (an IANA zone, default UTC), as
 *   `parseTimeFromUtc` does; an invalid zone returns "".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options optional: timeZone (IANA, default "UTC")
 * @returns Day (01-31) or "" on invalid input
 *
 * @example parseDayFromUtc("2024-03-17T14:30:45Z") // "17"
 * @example parseDayFromUtc("2024-03-17T02:30:45Z", { timeZone: "America/New_York" }) // "16"
 * @example parseDayFromUtc("invalid") // ""
 */
export function parseDayFromUtc(
  value: string,
  options?: { timeZone?: string },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  const dateTime = utcZonedDateTime(value, options);

  return dateTime === null ? "" : dateTime.day.toString().padStart(2, "0");
}
