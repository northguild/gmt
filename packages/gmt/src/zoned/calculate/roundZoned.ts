import { Temporal } from "@js-temporal/polyfill";
import type { FractionalDigit } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Round an ISO 8601 zoned datetime string to the specified unit.
 *
 * - Returns "" for invalid inputs.
 * - Accepts "day" and time units: "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Date units ("year", "month", "week") are not supported by the Temporal polyfill's ZonedDateTime.round() — they return "".
 * - Wraps Temporal.ZonedDateTime.round() which throws on invalid options.
 * - Note: The polyfill's `.round()` does not support `disambiguation` or `offset` options.
 *
 * @param value ISO 8601 zoned datetime string
 * @param options Rounding options: smallestUnit, optional roundingIncrement, roundingMode
 * @returns Rounded ISO 8601 zoned datetime string, or "" on invalid input
 *
 * @example roundZoned("2024-06-15T12:34:56-05:00[America/New_York]", { smallestUnit: "hour" }) // "2024-06-15T13:00:00-05:00[America/New_York]"
 * @example roundZoned("2024-06-15T12:34:56-05:00[America/New_York]", { smallestUnit: "minute", roundingIncrement: 15 }) // "2024-06-15T12:45:00-05:00[America/New_York]"
 * @example roundZoned("invalid", { smallestUnit: "hour" }) // ""
 */
export function roundZoned(
  value: string,
  options: {
    smallestUnit: Temporal.SmallestUnit<
      | "day"
      | "hour"
      | "minute"
      | "second"
      | "millisecond"
      | "microsecond"
      | "nanosecond"
    >;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
  },
): string {
  const { smallestUnit, roundingIncrement, roundingMode } = options;

  if (!isValidZonedDateTime(value)) return "";

  // Polyfill limitation: year/month/week not supported for ZonedDateTime.round()
  const supportedUnits: readonly string[] = [
    "day",
    "hour",
    "minute",
    "second",
    "millisecond",
    "microsecond",
    "nanosecond",
  ];
  if (!supportedUnits.includes(smallestUnit)) return "";

  try {
    const source = Temporal.ZonedDateTime.from(value);
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

    return result.toString({ fractionalSecondDigits: fractionalDigits });
  } catch {
    return "";
  }
}
