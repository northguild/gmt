// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { frameWallClock, normalizeZoneFrame } from "../../internal/zoneFrame";
import {
  resolveUnixEpochUnit,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Convert a Unix timestamp to a plain datetime string in the format "YYYY-MM-DDTHH:mm:ss".
 *
 * - Converts to PlainDateTime in `timeZone`.
 * - `unix` is a safe integer or a string of optionally negative ASCII digits; anything else returns
 *   "".
 * - Returns "" for invalid input.
 *
 * @param unix Unix epoch: a safe integer or a digit string
 * @param options optional: how `unix` is read and the zone its wall clock is read in
 * @returns plain datetime string in "YYYY-MM-DDTHH:mm:ss" format or "" on invalid input
 *
 * @example convertUnixToPlainDateTime(1709164800000, { timeZone: "UTC" }) // "2024-02-29T00:00:00"
 * @example convertUnixToPlainDateTime(1709164800, { epochUnit: "seconds", timeZone: "UTC" }) // "2024-02-29T00:00:00"
 * @example convertUnixToPlainDateTime(-1, { timeZone: "UTC" }) // "1969-12-31T23:59:59.999"
 * @example convertUnixToPlainDateTime("1709164800000", { timeZone: "Asia/Tokyo" }) // "2024-02-29T09:00:00"
 * @example convertUnixToPlainDateTime(NaN) // ""
 * @example convertUnixToPlainDateTime(45870000, { timeZone: "-00:44:30" }) // "1970-01-01T12:00:00" (a stored offset with seconds)
 */

export function convertUnixToPlainDateTime(
  unix: number | string,
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

    const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
    const frame = normalizeZoneFrame(options?.timeZone);

    if (epochUnit === null || frame === null) return "";

    const instant = unixEpochToInstant(unix, epochUnit);

    if (instant === null) return "";

    try {
      return frameWallClock(instant, frame).toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
