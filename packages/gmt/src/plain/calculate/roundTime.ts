// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import {
  defaultFractionalDigits,
  isObject,
  resolveDateTimeUnit,
} from "../../internal";
import { isValidTime, isValidTimeUnit } from "../validate";

/**
 * Round an ISO 8601 time string to the specified time unit.
 *
 * - Returns "" for invalid inputs.
 * - Wraps Temporal.PlainTime.round() which throws on invalid options.
 * - Output precision follows `smallestUnit`: no fractional seconds for "second" and coarser,
 *   3 digits for "millisecond", 6 for "microsecond" and 9 for "nanosecond", so the result never
 *   hides the precision the unit asked for.
 *
 * @param value ISO 8601 time string
 * @param options The unit to round to and how to round
 * @returns Rounded ISO 8601 time string, or "" on invalid input
 *
 * @example roundTime("12:34:56", { smallestUnit: "hour" }) // "13:00:00"
 * @example roundTime("12:34:56", { smallestUnit: "minute" }) // "12:35:00"
 * @example roundTime("12:34:56", { smallestUnit: "second", roundingMode: "floor" }) // "12:34:56"
 * @example roundTime("12:34:56", { smallestUnit: "hours" }) // "13:00:00" (plural unit name)
 * @example roundTime("12:34:56.123456789", { smallestUnit: "microsecond" }) // "12:34:56.123457" (precision follows the unit)
 * @example roundTime("invalid", { smallestUnit: "hour" }) // ""
 */
export function roundTime(
  value: string,
  options: {
    /**
     * The unit to round to, a time unit from `"hour"` to `"nanosecond"`, singular or plural, as
     * Temporal's GetTemporalUnitValuedOption accepts both. It also sets how many fractional-second
     * digits the result is written with. A date unit returns `""`.
     */
    smallestUnit: Temporal.SmallestUnit<Temporal.TimeUnit>;
    /**
     * How many units make one rounding step. Temporal requires it to divide the next larger
     * unit evenly and be smaller than it (`15` minutes, not `7` or `60`), and truncates a
     * non-integer; any other value returns `""`.
     *
     * @defaultValue `1`, Temporal's default.
     */
    roundingIncrement?: number;
    /**
     * Which way a time between two steps goes: one of Temporal's nine rounding modes, such as
     * `"floor"`, `"ceil"` or `"halfExpand"` (to the nearer step, a tie going up). Any other value
     * returns `""`.
     *
     * @defaultValue `"halfExpand"`, Temporal's default.
     */
    roundingMode?: Temporal.RoundingMode;
  },
): string {
  try {
    if (!isObject(options)) return "";

    const { roundingIncrement, roundingMode } = options;
    // One read (GetOption): resolveDateTimeUnit returns a value that is not a string unchanged.
    const smallestUnit: unknown = resolveDateTimeUnit(
      options.smallestUnit as unknown,
    );

    if (!isValidTime(value) || !isValidTimeUnit(smallestUnit)) return "";

    try {
      const source = Temporal.PlainTime.from(value);
      const result = source.round({
        smallestUnit,
        roundingIncrement,
        roundingMode,
      });

      const fractionalDigits = defaultFractionalDigits(smallestUnit);

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
