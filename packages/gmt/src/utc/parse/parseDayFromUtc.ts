import { utcWallClock } from "../../internal/utcWallClock";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the day of month (1-31) from a UTC datetime string.
 *
 * - Returns zero-padded string for day.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options The time zone the value is read in
 * @returns Day (01-31) or "" on invalid input
 *
 * @example parseDayFromUtc("2024-03-17T14:30:45Z") // "17"
 * @example parseDayFromUtc("2024-03-17T02:30:45Z", { timeZone: "America/New_York" }) // "16"
 * @example parseDayFromUtc("invalid") // ""
 */
export function parseDayFromUtc(
  value: string,
  options?: {
    /**
     * The time zone the wall-clock fields are read in: an IANA name, a UTC offset (a time zone
     * identifier such as `+05:30`, `+0530` or `-08`, or a stored offset `±HH:MM[:SS]`, what
     * `getTimeZoneOffset` returns), or `"local"` for the system time zone. An unknown zone returns
     * `""`.
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

    const dateTime = utcWallClock(value, options);

    return dateTime === null ? "" : dateTime.day.toString().padStart(2, "0");
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
