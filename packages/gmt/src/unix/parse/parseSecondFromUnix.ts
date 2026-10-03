import { parseUnitFromUnix } from "./parseUnitFromUnix";
import type { UnixUnit } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the second (0-59) from a unix epoch value.
 *
 * - Delegates to {@link parseUnitFromUnix} with unit "second".
 * - `value` is a safe integer or a digit string.
 * - Returns "" for invalid input.
 *
 * @param value unix epoch in milliseconds or seconds: a safe integer, or a string of optionally negative ASCII digits
 * @param options optional: how `value` is read and the zone its wall clock is read in
 * @returns Second (00-59) or "" on invalid input
 *
 * @example parseSecondFromUnix(1700000000000, { timeZone: "UTC" }) // "20"
 * @example parseSecondFromUnix(-86400, { epochUnit: "seconds" }) // "00"
 * @example parseSecondFromUnix("") // "" (a blank string is not epoch 0)
 */
export function parseSecondFromUnix(
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

    return parseUnitFromUnix(value, "second", options);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
