import { Temporal } from "@js-temporal/polyfill";
import { frameWallClock, normalizeZoneFrame } from "../../internal/zoneFrame";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Extract the time portion from a UTC datetime string.
 *
 * - Uses Temporal.Instant.from to parse, converts to the `timeZone` option's zone.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param options The time zone the value is read in
 * @returns ISO time string (e.g., "14:30:45") or "" on invalid input
 *
 * @example parseTimeFromUtc("2024-03-17T14:30:45Z") // "14:30:45"
 * @example parseTimeFromUtc("2024-03-17T14:30:45Z", { timeZone: "America/New_York" }) // "10:30:45"
 * @example parseTimeFromUtc("invalid") // ""
 * @example parseTimeFromUtc("1970-01-01T12:44:30Z", { timeZone: "-00:44:30" }) // "12:00:00" (a stored offset with seconds)
 */
export function parseTimeFromUtc(
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

    if (!isValidUtc(value)) {
      return "";
    }

    const frame = normalizeZoneFrame(options?.timeZone);
    if (frame === null) {
      return "";
    }

    try {
      const instant = Temporal.Instant.from(value);
      const dateTime = frameWallClock(instant, frame);
      return dateTime.toPlainTime().toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
