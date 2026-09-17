import { utcZonedDateTime } from "../../internal/utcZonedDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the microsecond (0-999) from a UTC datetime string.
 *
 * - Returns zero-padded string for microsecond.
 * - Reads the value on the wall clock of `options.timeZone` (an IANA zone, default UTC), as
 *   `parseTimeFromUtc` does; an invalid zone returns "".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45.123Z")
 * @param options optional: timeZone (IANA, default "UTC")
 * @returns Microsecond (000-999) or "" on invalid input
 *
 * @example parseMicrosecondFromUtc("2024-03-17T14:30:45.123Z") // "000"
 * @example parseMicrosecondFromUtc("2024-03-17T14:30:45.123456Z") // "456"
 * @example parseMicrosecondFromUtc("2024-03-17T14:30:45.123456Z", { timeZone: "America/New_York" }) // "456"
 * @example parseMicrosecondFromUtc("invalid") // ""
 */
export function parseMicrosecondFromUtc(
  value: string,
  options?: { timeZone?: string },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  const dateTime = utcZonedDateTime(value, options);

  return dateTime === null
    ? ""
    : dateTime.microsecond.toString().padStart(3, "0");
}
