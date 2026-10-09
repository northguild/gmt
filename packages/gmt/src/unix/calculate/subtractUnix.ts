// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import type { Temporal } from "@js-temporal/polyfill";
import {
  frameInstant,
  frameZoned,
  isValidAmount,
  normalizeZoneFrame,
  resolveOverflow,
  subtractFromZoned,
} from "../../internal";
import {
  resolveUnixEpochUnit,
  toUnixEpoch,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, Overflow } from "../../types";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isObject, isOptionsArgument } from "../../internal/isObject";

/**
 * Subtract a temporal amount from a Unix epoch value and return the resulting epoch.
 *
 * - Converts to ZonedDateTime, subtracts the duration, then converts back to epoch.
 * - Validates duration units and values.
 * - `value` is a safe integer or a digit string (`"1706659200000"`); anything else returns null.
 * - Returns null for invalid input.
 * - **Limit at an offset with seconds.** The instant is placed in the offset's whole-minute zone,
 *   moved by its seconds, and the moved instant must be inside Temporal's range. So within the
 *   offset's seconds (under a minute) of the last instant Temporal supports
 *   (`+275760-09-13T00:00:00Z`) for an offset east of UTC, or of the first
 *   (`-271821-04-20T00:00:00Z`) for one west, this returns `null`. An offset to the minute has no
 *   such limit.
 *
 * @param value Unix epoch: a safe integer, or a string of optionally negative ASCII digits
 * @param units Partial<Record<DateTimeDurationUnit, number>> object specifying units to subtract
 * @param options optional: how `value` is read and how an out-of-range result day is handled
 * @returns Unix epoch number after subtraction, or null on invalid input
 *
 * @example subtractUnix(1706745600000, { days: 1 }) // 1706659200000
 * @example subtractUnix(1706745600, { days: 1 }, { epochUnit: "seconds" }) // 1706659200
 * @example subtractUnix(0, { days: 1 }) // -86400000 (Jan 1 1970 - 1 day = Dec 31 1969)
 * @example subtractUnix(1.5, { days: 1 }) // null (not an integer epoch)
 * @example subtractUnix("1706659200000", { days: 1 }) // 1706572800000 (digit string)
 * @example subtractUnix(1706659200000, { days: 1 }, { timeZone: "Mars/Olympus" }) // null (unknown zone)
 */
export function subtractUnix(
  value: number | string,
  units: Partial<Record<DateTimeDurationUnit, number>>,
  options?: {
    /**
     * The unit the epoch values are counted in: `"seconds"` or `"milliseconds"`, singular or
     * plural. Any other value returns `null`. The result is in the same unit.
     *
     * @defaultValue `"milliseconds"`
     */
    epochUnit?: UnixUnit;
    /**
     * The time zone the calendar arithmetic runs in: an IANA name, a UTC offset (a time zone
     * identifier such as `+05:30`, `+0530` or `-08`, or a stored offset `±HH:MM[:SS]`, what
     * `getTimeZoneOffset` returns), or `"local"` for the system time zone. An unknown zone returns
     * `null`.
     *
     * @defaultValue `"UTC"`
     */
    timeZone?: string;
    /**
     * How a result day that does not exist in its month is handled, such as March 31 minus one
     * month. `"constrain"` clamps to the last valid day, and `"reject"` returns `null`.
     *
     * @defaultValue `"constrain"`, Temporal's default.
     */
    overflow?: Overflow;
  },
): number | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }

    const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
    const frame = normalizeZoneFrame(options?.timeZone);
    const overflow = resolveOverflow(options?.overflow);

    if (frame === null || epochUnit === null) return null;

    const validUnits =
      isObject(units) && Object.keys(units).every(isValidDateTimeDurationUnit);
    const validAmounts =
      validUnits && Object.values(units).every(isValidAmount);

    if (!validUnits || !validAmounts) {
      return null;
    }

    const instant = unixEpochToInstant(value, epochUnit);

    if (instant === null) {
      return null;
    }

    try {
      const zdt: Temporal.ZonedDateTime = frameZoned(instant, frame);
      return toUnixEpoch(
        frameInstant(subtractFromZoned(zdt, units, { overflow }), frame),
        epochUnit,
      );
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
