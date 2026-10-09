// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { frameWallClock, normalizeZoneFrame } from "../../internal/zoneFrame";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Convert a UTC datetime string to a plain time string in the format "HH:mm:ss".
 *
 * - Converts to the `timeZone` option's zone before extracting the time.
 * - Returns "" for invalid input.
 *
 * @param value UTC datetime string (e.g., "2024-02-29T00:00:00Z")
 * @param options The time zone the value is read in
 * @returns plain time string in "HH:mm:ss" format or "" on invalid input
 *
 * @example convertUtcToPlainTime("2024-02-29T00:00:00Z") // "00:00:00"
 * @example convertUtcToPlainTime("2024-02-29T00:00:00Z", { timeZone: "America/New_York" }) // "19:00:00"
 * @example convertUtcToPlainTime("invalid") // ""
 * @example convertUtcToPlainTime("1970-01-01T12:44:30Z", { timeZone: "-00:44:30" }) // "12:00:00" (a stored offset with seconds)
 */
export function convertUtcToPlainTime(
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

    const frame = normalizeZoneFrame(options?.timeZone);

    if (frame === null) return "";
    if (!isValidUtc(value)) return "";

    try {
      const instant = Temporal.Instant.from(value);
      const wallClock = frameWallClock(instant, frame);
      return `${wallClock.hour.toString().padStart(2, "0")}:${wallClock.minute
        .toString()
        .padStart(2, "0")}:${wallClock.second.toString().padStart(2, "0")}`;
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
