import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain";
import type { FractionalDigit } from "../../types";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Round a UTC datetime string to the specified unit.
 *
 * - Converts to Instant, rounds, converts back to UTC Instant string.
 * - Supports: "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Date units ("year", "month", "week", "day") are not supported by the Temporal polyfill's Instant.round() — they return "".
 * - Wraps all Temporal calls in try-catch; returns "" on any error.
 *
 * @param value ISO UTC datetime string
 * @param options Rounding options: smallestUnit, optional roundingIncrement, roundingMode, fractionalSecondDigits
 * @returns Rounded ISO UTC Instant string, or "" on invalid input
 *
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "hour" }) // "2024-06-15T13:00:00Z"
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "minute", roundingIncrement: 15 }) // "2024-06-15T12:45:00Z"
 * @example roundUtc("2024-06-15T12:34:56Z", { smallestUnit: "second", roundingMode: "floor" }) // "2024-06-15T12:34:56Z"
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
  const {
    smallestUnit,
    roundingIncrement,
    roundingMode,
    fractionalSecondDigits,
  } = options;

  if (!isValidUtc(value) || !isValidDateTimeUnit(smallestUnit)) return "";

  // Polyfill limitation: day/year/month/week not supported for Instant.round()
  const supportedUnits: readonly string[] = [
    "hour",
    "minute",
    "second",
    "millisecond",
    "microsecond",
    "nanosecond",
  ];
  if (!supportedUnits.includes(smallestUnit)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const result = instant.round({
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
    const fractionalDigits =
      fractionalSecondDigits ?? (precisionMap[smallestUnit] || 0);

    return result.toString({ fractionalSecondDigits: fractionalDigits });
  } catch {
    return "";
  }
}
