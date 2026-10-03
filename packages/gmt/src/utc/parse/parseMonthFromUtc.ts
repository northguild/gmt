import { utcZonedDateTime } from "../../internal/utcZonedDateTime";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the month (1-12) from a UTC datetime string.
 *
 * - Returns zero-padded string for month.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options The time zone the value is read in
 * @returns Month (01-12) or "" on invalid input
 *
 * @example parseMonthFromUtc("2024-03-17T14:30:45Z") // "03"
 * @example parseMonthFromUtc("2025-01-01T02:00:00Z", { timeZone: "America/New_York" }) // "12"
 * @example parseMonthFromUtc("invalid") // ""
 */
export function parseMonthFromUtc(
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

    return dateTime === null ? "" : dateTime.month.toString().padStart(2, "0");
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
