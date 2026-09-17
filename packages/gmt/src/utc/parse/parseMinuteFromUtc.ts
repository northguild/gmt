import { utcZonedDateTime } from "../../internal/utcZonedDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the minute (0-59) from a UTC datetime string.
 *
 * - Returns zero-padded string for minute.
 * - Reads the value on the wall clock of `options.timeZone` (an IANA zone, default UTC), as
 *   `parseTimeFromUtc` does; an invalid zone returns "".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options optional: timeZone (IANA, default "UTC")
 * @returns Minute (00-59) or "" on invalid input
 *
 * @example parseMinuteFromUtc("2024-03-17T14:30:45Z") // "30"
 * @example parseMinuteFromUtc("2024-03-17T02:30:45Z", { timeZone: "Asia/Kolkata" }) // "00"
 * @example parseMinuteFromUtc("invalid") // ""
 */
export function parseMinuteFromUtc(
  value: string,
  options?: { timeZone?: string },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  const dateTime = utcZonedDateTime(value, options);

  return dateTime === null ? "" : dateTime.minute.toString().padStart(2, "0");
}
