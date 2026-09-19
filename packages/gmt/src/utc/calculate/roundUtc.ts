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
 * - Supports: "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Each unit is accepted in its singular or plural form ("hour" or "hours"), as Temporal's
 *   GetTemporalUnitValuedOption accepts both.
 * - Day and larger units ("day", "week", "month", "year") return "". This is the Temporal spec, not
 *   a polyfill limitation: `Instant.prototype.round` validates `smallestUnit` as a time unit
 *   (ValidateTemporalUnitValue with ~time~), because an instant has no calendar or zone to define a
 *   day. Round a zoned value with `roundZoned` for a day boundary.
 * - Wraps all Temporal calls in try-catch; returns "" on any error.
 *
 * @param value ISO UTC datetime string
 * @param options Rounding options: smallestUnit, optional roundingIncrement, roundingMode, fractionalSecondDigits
 * @returns Rounded ISO UTC Instant string, or "" on invalid input
 *
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "hour" }) // "2024-06-15T13:00:00Z"
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "minute", roundingIncrement: 15 }) // "2024-06-15T12:30:00Z"
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "second", roundingMode: "floor" }) // "2024-06-15T12:34:56Z"
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "hours" }) // "2024-06-15T13:00:00Z" (plural unit name)
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "day" as never }) // "" (Instant rounds to time units only)
 * @example roundUtc("invalid", { smallestUnit: "hour" }) // ""
 * @example roundUtc("", { smallestUnit: "hour" }) // ""
 */
export function roundUtc(
  value: string,
  options: {
    smallestUnit: Temporal.SmallestUnit<
      | "hour"
      | "minute"
      | "second"
      | "millisecond"
      | "microsecond"
      | "nanosecond"
    >;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
    fractionalSecondDigits?: FractionalDigit;
  },
): string {
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
}
