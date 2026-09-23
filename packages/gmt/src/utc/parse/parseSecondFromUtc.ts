import { utcZonedDateTime } from "../../internal/utcZonedDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the second (0-59) from a UTC datetime string.
 *
 * - Returns zero-padded string for second.
 * - Reads the value on the wall clock of `options.timeZone` (an IANA zone, default UTC), as
 *   `parseTimeFromUtc` does; an invalid zone returns "".
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options optional: timeZone (IANA, default "UTC")
 * @returns Second (00-59) or "" on invalid input
 *
 * @example parseSecondFromUtc("2024-03-17T14:30:45Z") // "45"
 * @example parseSecondFromUtc("2024-03-17T14:30:45Z", { timeZone: "America/New_York" }) // "45"
 * @example parseSecondFromUtc("invalid") // ""
 */
export function parseSecondFromUtc(
  value: string,
  options?: { timeZone?: string },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    const dateTime = utcZonedDateTime(value, options);

    return dateTime === null ? "" : dateTime.second.toString().padStart(2, "0");
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
