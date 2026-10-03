import { utcZonedDateTime } from "../../internal/utcZonedDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the microsecond (0-999) from a UTC datetime string.
 *
 * - Returns zero-padded string for microsecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45.123Z")
 * @param options The time zone the value is read in
 * @returns Microsecond (000-999) or "" on invalid input
 *
 * @example parseMicrosecondFromUtc("2024-03-17T14:30:45.123Z") // "000"
 * @example parseMicrosecondFromUtc("2024-03-17T14:30:45.123456Z") // "456"
 * @example parseMicrosecondFromUtc("2024-03-17T14:30:45.123456Z", { timeZone: "America/New_York" }) // "456"
 * @example parseMicrosecondFromUtc("invalid") // ""
 */
export function parseMicrosecondFromUtc(
  value: string,
  options?: {
    /**
     * The time zone the wall-clock fields are read in: an IANA name, a UTC offset, or `"local"` for
     * the system time zone. An unknown zone returns `""`.
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
      : dateTime.microsecond.toString().padStart(3, "0");
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
