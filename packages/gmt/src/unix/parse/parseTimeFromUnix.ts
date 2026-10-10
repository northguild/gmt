import { unixWallClock } from "../../internal/unixWallClock";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Extract the time portion from a unix epoch value.
 *
 * - Converts to ZonedDateTime then extracts the PlainTime.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: how `value` is read and the zone its wall clock is read in
 * @returns ISO time string (e.g., "14:30:45") or "" on invalid input
 *
 * @example parseTimeFromUnix(1700000000000, { timeZone: "UTC" }) // "22:13:20"
 * @example parseTimeFromUnix(1700000000, { epochUnit: "seconds", timeZone: "UTC" }) // "22:13:20"
 * @example parseTimeFromUnix(-86400, { epochUnit: "seconds", timeZone: "UTC" }) // "00:00:00"
 * @example parseTimeFromUnix("1700000000", { epochUnit: "second" }) // "22:13:20" (digit string, UTC by default)
 * @example parseTimeFromUnix(1.5) // "" (not an integer epoch)
 * @example parseTimeFromUnix(45870000, { timeZone: "-00:44:30" }) // "12:00:00" (a stored offset with seconds)
 */
export function parseTimeFromUnix(
  value: number | string,
  options?: {
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns `""`.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
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

    const wallClock = unixWallClock(value, options);

    return wallClock === null ? "" : wallClock.toPlainTime().toString();
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
