// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { frameWallClock, normalizeZoneFrame } from "../../internal/zoneFrame";
import { isValidUtc } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Convert a UTC datetime string to a plain date string in the format "YYYY-MM-DD".
 *
 * - Converts to the `timeZone` option's zone before extracting the date.
 * - A year outside 0000–9999 is written with a sign and six digits (`+010000`, `-000005`), as
 *   Temporal writes it, so the result is always a string `isValidDate` accepts.
 * - Returns "" for invalid input.
 *
 * @param value UTC datetime string (e.g., "2024-02-29T00:00:00Z")
 * @param options The time zone the value is read in
 * @returns plain date string in "YYYY-MM-DD" format or "" on invalid input
 *
 * @example convertUtcToPlainDate("2024-02-29T00:00:00Z") // "2024-02-29"
 * @example convertUtcToPlainDate("2024-02-29T00:00:00Z", { timeZone: "America/New_York" }) // "2024-02-28"
 * @example convertUtcToPlainDate("invalid") // ""
 * @example convertUtcToPlainDate("+010000-01-01T00:00:00Z") // "+010000-01-01" (a year past 9999 has a sign and six digits)
 * @example convertUtcToPlainDate("1970-01-01T00:30:00Z", { timeZone: "-00:44:30" }) // "1969-12-31" (a stored offset with seconds)
 */
export function convertUtcToPlainDate(
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
      // Temporal writes the date, so a year outside 0000 to 9999 gets its sign and six digits.
      return wallClock.toPlainDate().toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
