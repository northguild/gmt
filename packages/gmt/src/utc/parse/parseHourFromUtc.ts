import { utcZonedDateTime } from "../../internal/utcZonedDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the hour (0-23) from a UTC datetime string.
 *
 * - Returns zero-padded string for hour.
 * - Reads the value on the wall clock of `options.timeZone` (an IANA zone, default UTC), as
 *   `parseTimeFromUtc` does; an invalid zone returns "".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options optional: timeZone (IANA, default "UTC")
 * @returns Hour (00-23) or "" on invalid input
 *
 * @example parseHourFromUtc("2024-03-17T14:30:45Z") // "14"
 * @example parseHourFromUtc("2024-03-17T02:30:45Z", { timeZone: "America/New_York" }) // "22"
 * @example parseHourFromUtc("invalid") // ""
 */
export function parseHourFromUtc(
  value: string,
  options?: { timeZone?: string },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  const dateTime = utcZonedDateTime(value, options);

  return dateTime === null ? "" : dateTime.hour.toString().padStart(2, "0");
}
