import { Temporal } from "@js-temporal/polyfill";
import type { FractionalDigit } from "../../types";
import { isValidTime, isValidTimeUnit } from "../validate";

/**
 * Round an ISO 8601 time string to the specified time unit.
 *
 * - Returns "" for invalid inputs.
 * - Only time units are accepted: "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Wraps Temporal.PlainTime.round() which throws on invalid options.
 *
 * @param value ISO 8601 time string
 * @param options Rounding options: smallestUnit, optional roundingIncrement and roundingMode
 * @returns Rounded ISO 8601 time string, or "" on invalid input
 *
 * @example roundTime("12:34:56", { smallestUnit: "hour" }) // "13:00:00"
 * @example roundTime("12:34:56", { smallestUnit: "minute" }) // "12:35:00"
 * @example roundTime("12:34:56", { smallestUnit: "second", roundingMode: "floor" }) // "12:34:56"
 * @example roundTime("invalid", { smallestUnit: "hour" }) // ""
 */
export function roundTime(
  value: string,
  options: {
    smallestUnit: Temporal.SmallestUnit<"hour">;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
  },
): string {
  const { smallestUnit, roundingIncrement, roundingMode } = options;

  if (!isValidTime(value) || !isValidTimeUnit(smallestUnit)) return "";

  try {
    const source = Temporal.PlainTime.from(value);
    const result = source.round({
      smallestUnit,
      roundingIncrement,
      roundingMode,
    });

    // Handle default precision: 0 for > sec, 3 for ms, 6 for µs, 9 for ns
    const precisionMap: Record<string, FractionalDigit> = {
      millisecond: 3,
      microsecond: 6,
      nanosecond: 9,
    };
    const fractionalDigits = precisionMap[smallestUnit] || 0;

    return result.toString({
      fractionalSecondDigits: fractionalDigits,
    });
  } catch {
    return "";
  }
}
