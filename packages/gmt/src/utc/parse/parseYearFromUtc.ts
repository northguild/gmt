import { utcWallClock } from "../../internal/utcWallClock";
import { isOptionsArgument } from "../../internal/isObject";
import { isoYearString } from "../../internal/isoYearString";

/**
 * Return the year from a UTC datetime string.
 *
 * - Returns the year as Temporal writes it: four digits (`"2024"`, `"0005"`), or a sign and six
 *   digits outside 0000–9999 (`"+010000"`, `"-000005"`).
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options The time zone the value is read in
 * @returns the year as four digits, or a sign and six digits outside 0000–9999, or "" on invalid input
 *
 * @example parseYearFromUtc("2024-03-17T14:30:45Z") // "2024"
 * @example parseYearFromUtc("0005-06-01T12:30:00Z") // "0005"
 * @example parseYearFromUtc("2025-01-01T02:00:00Z", { timeZone: "America/New_York" }) // "2024"
 * @example parseYearFromUtc("invalid") // ""
 */
export function parseYearFromUtc(
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

    return dateTime === null ? "" : isoYearString(dateTime.year);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
