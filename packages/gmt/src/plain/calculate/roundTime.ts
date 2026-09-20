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
 * - Only time units are accepted: "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Each unit is accepted in its singular or plural form ("hour" or "hours"), as Temporal's
 *   GetTemporalUnitValuedOption accepts both.
 * - Wraps Temporal.PlainTime.round() which throws on invalid options.
 * - Output precision follows `smallestUnit`: no fractional seconds for "second" and coarser,
 *   3 digits for "millisecond", 6 for "microsecond" and 9 for "nanosecond", so the result never
 *   hides the precision the unit asked for.
 *
 * @param value ISO 8601 time string
 * @param options Rounding options: smallestUnit, optional roundingIncrement and roundingMode
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
    smallestUnit: Temporal.SmallestUnit<Temporal.TimeUnit>;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
  },
): string {
  if (!isObject(options)) return "";

  const { roundingIncrement, roundingMode } = options;
  const smallestUnit: unknown =
    typeof options.smallestUnit === "string"
      ? resolveDateTimeUnit(options.smallestUnit)
      : options.smallestUnit;

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
}
