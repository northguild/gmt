import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the year from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "year".
 * - `value` is a safe integer or a digit string.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: how `value` is read and the zone its wall clock is read in
 * @returns Year (YYYY) or "" on invalid input
 *
 * @example parseYearFromUnix(1700000000000) // "2023"
 * @example parseYearFromUnix(1704067200000, { epochUnit: "milliseconds", timeZone: "UTC" }) // "2024"
 * @example parseYearFromUnix(-86400, { epochUnit: "seconds" }) // "1969"
 * @example parseYearFromUnix("") // "" (a blank string is not epoch 0)
 */
export function parseYearFromUnix(
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

    return parseUnitFromUnix(value, "year", options);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
