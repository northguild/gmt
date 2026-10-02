import { utcZonedDateTime } from "../../internal/utcZonedDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the nanosecond (0-999) from a UTC datetime string.
 *
 * - Returns zero-padded string for nanosecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45.123Z")
 * @param options The time zone the value is read in
 * @returns Nanosecond (000-999) or "" on invalid input
 *
 * @example parseNanosecondFromUtc("2024-03-17T14:30:45.123Z") // "000"
 * @example parseNanosecondFromUtc("2024-03-17T14:30:45.123456789Z") // "789"
 * @example parseNanosecondFromUtc("2024-03-17T14:30:45.123456789Z", { timeZone: "America/New_York" }) // "789"
 * @example parseNanosecondFromUtc("invalid") // ""
 */
export function parseNanosecondFromUtc(
  value: string,
  options?: {
    /**
     * The time zone whose wall clock the value is read on: an IANA name, a UTC offset, or
     * `"local"` for the system time zone. An invalid zone returns `""`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
  },
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }

    const dateTime = utcZonedDateTime(value, options);

    return dateTime === null
      ? ""
      : dateTime.nanosecond.toString().padStart(3, "0");
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
