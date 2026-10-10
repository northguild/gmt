import { utcWallClock } from "../../internal/utcWallClock";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the minute (0-59) from a UTC datetime string.
 *
 * - Returns zero-padded string for minute.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options The time zone the value is read in
 * @returns Minute (00-59) or "" on invalid input
 *
 * @example parseMinuteFromUtc("2024-03-17T14:30:45Z") // "30"
 * @example parseMinuteFromUtc("2024-03-17T02:30:45Z", { timeZone: "Asia/Kolkata" }) // "00"
 * @example parseMinuteFromUtc("invalid") // ""
 */
export function parseMinuteFromUtc(
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

    return dateTime === null ? "" : dateTime.minute.toString().padStart(2, "0");
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
