import { unixWallClock } from "../../internal/unixWallClock";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the day of week (1-7) from a unix epoch value.
 *
 * - Monday=1 through Sunday=7.
 * - Returns null for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: how `value` is read and the zone its wall clock is read in
 * @returns Day of week (1-7) or null on invalid input
 *
 * @example parseDayOfWeekFromUnix(1704067200000, { timeZone: "UTC" }) // 1
 * @example parseDayOfWeekFromUnix(-86400, { epochUnit: "seconds", timeZone: "UTC" }) // 3
 * @example parseDayOfWeekFromUnix("1704067200000") // 1 (digit string, UTC by default)
 * @example parseDayOfWeekFromUnix(" 1704067200000") // null (a padded string is not an epoch)
 * @example parseDayOfWeekFromUnix("") // null (a blank string is not epoch 0)
 */
export function parseDayOfWeekFromUnix(
  value: number | string,
  options?: {
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns `null`.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
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

    return unixWallClock(value, options)?.dayOfWeek ?? null;
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
