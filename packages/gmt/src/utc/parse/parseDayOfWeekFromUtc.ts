import { Temporal } from "@js-temporal/polyfill";
import { frameWallClock, normalizeZoneFrame } from "../../internal/zoneFrame";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the day of week (1-7) from a UTC datetime string.
 *
 * - Monday=1 through Sunday=7.
 * - Returns null for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options The time zone the value is read in
 * @returns Day of week (1-7) or null on invalid input
 *
 * @example parseDayOfWeekFromUtc("2024-03-17T14:30:45Z") // 7
 * @example parseDayOfWeekFromUtc("2024-03-18T00:00:00Z") // 1
 * @example parseDayOfWeekFromUtc("2024-03-17T02:30:45Z", { timeZone: "America/New_York" }) // 6 (Saturday in New York)
 * @example parseDayOfWeekFromUtc("invalid") // null
 */
export function parseDayOfWeekFromUtc(
  value: string,
  options?: {
    /**
     * The time zone the wall-clock fields are read in: an IANA name, a UTC offset (a time zone
     * identifier such as `+05:30`, `+0530` or `-08`, or a stored offset `±HH:MM[:SS]`, what
     * `getTimeZoneOffset` returns), or `"local"` for the system time zone. An unknown zone returns
     * `null`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
  },
): number | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    if (!isValidUtc(value)) return null;

    const frame = normalizeZoneFrame(options?.timeZone);
    if (frame === null) return null;

    try {
      const dateTime = frameWallClock(Temporal.Instant.from(value), frame);
      return dateTime.dayOfWeek;
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
