import { Temporal } from "@js-temporal/polyfill";
import {
  defaultFractionalDigits,
  isObject,
  resolveDateTimeUnit,
} from "../../internal";
import { isValidTimeUnit } from "../../plain";
import type { FractionalDigit } from "../../types";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Round a UTC datetime string to the specified unit.
 *
 * - Converts to Instant, rounds, converts back to UTC Instant string.
 * - Day and larger units ("day", "week", "month", "year") return "". This is the Temporal spec, not
 *   a polyfill limitation: `Instant.prototype.round` validates `smallestUnit` as a time unit
 *   (ValidateTemporalUnitValue with ~time~), because an instant has no calendar or zone to define a
 *   day. Round a zoned value with `roundZoned` for a day boundary.
 * - Wraps all Temporal calls in try-catch; returns "" on any error.
 *
 * @param value ISO UTC datetime string
 * @param options What to round to, how, and the precision of the result
 * @returns Rounded ISO UTC Instant string, or "" on invalid input
 *
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "hour" }) // "2024-06-15T13:00:00Z"
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "minute", roundingIncrement: 15 }) // "2024-06-15T12:30:00Z"
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "second", roundingMode: "floor" }) // "2024-06-15T12:34:56Z"
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "hours" }) // "2024-06-15T13:00:00Z" (plural unit name)
 * @example roundUtc("2024-06-15T12:34:56.123456789Z", { smallestUnit: "microsecond" }) // "2024-06-15T12:34:56.123457Z" (precision follows the unit)
 * @example roundUtc("2024-06-15T12:34:56.123456789Z", { smallestUnit: "nanosecond", fractionalSecondDigits: 3 }) // "2024-06-15T12:34:56.123Z" (explicit digits win)
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "day" as never }) // "" (Instant rounds to time units only)
 * @example roundUtc("invalid", { smallestUnit: "hour" }) // ""
 * @example roundUtc("", { smallestUnit: "hour" }) // ""
 */
export function roundUtc(
  value: string,
  options: {
    /**
     * The unit to round to: `"hour"`, `"minute"`, `"second"`, `"millisecond"`, `"microsecond"` or
     * `"nanosecond"`, singular or plural as Temporal's GetTemporalUnitValuedOption accepts both.
     */
    smallestUnit: Temporal.SmallestUnit<
      | "hour"
      | "minute"
      | "second"
      | "millisecond"
      | "microsecond"
      | "nanosecond"
    >;
    /**
     * The multiple of `smallestUnit` to round to, such as 15 for quarter hours. It must divide a
     * 24-hour day evenly (Temporal's `Instant.prototype.round`); any other value returns `""`.
     *
     * @defaultValue `1`, Temporal's default.
     */
    roundingIncrement?: number;
    /**
     * Which multiple a value between two is rounded to. `"halfExpand"` picks the nearer one and
     * sends a tie to the later instant; `"floor"` and `"trunc"` pick the earlier, `"ceil"` and
     * `"expand"` the later, and the other `"half…"` modes differ only in how a tie breaks.
     *
     * @defaultValue `"halfExpand"`, Temporal's default.
     */
    roundingMode?: Temporal.RoundingMode;
    /**
     * The number of fractional-second digits the result is written with, `0` to `9`, or `"auto"` to
     * drop trailing zeros. It overrides the unit's own count, coarser or finer; an invalid value
     * returns `""`.
     *
     * @defaultValue The digits `smallestUnit` names: `3` for `"millisecond"`, `6` for
     * `"microsecond"`, `9` for `"nanosecond"` and `0` for any coarser unit.
     */
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
  try {
    if (!isObject(options)) return "";

    const { roundingIncrement, roundingMode, fractionalSecondDigits } = options;
    const smallestUnit: unknown =
      typeof options.smallestUnit === "string"
        ? resolveDateTimeUnit(options.smallestUnit)
        : options.smallestUnit;

    // Temporal Instant.prototype.round: ValidateTemporalUnitValue(smallestUnit, ~time~)
    if (!isValidUtc(value) || !isValidTimeUnit(smallestUnit)) return "";

    try {
      const instant = Temporal.Instant.from(value);
      const result = instant.round({
        smallestUnit,
        roundingIncrement,
        roundingMode,
      });

      const fractionalDigits = defaultFractionalDigits(
        smallestUnit,
        fractionalSecondDigits,
      );

      return result.toString({ fractionalSecondDigits: fractionalDigits });
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
