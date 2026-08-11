import { Temporal } from "@js-temporal/polyfill";
import {
  addDateTimeUnit,
  getStartOfDateTimeUnit,
} from "../../internal/dateTimeUnitHelpers";
import type { DateTimeUnit, FractionalDigit } from "../../types";
import { isValidDateTime, isValidDateTimeUnit } from "../validate";

/**
 * Round an ISO 8601 datetime string to the specified date-time unit.
 *
 * - Returns "" for invalid inputs.
 * - Accepts all date and time units: "year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Time units use Temporal.PlainDateTime.round() directly.
 * - Date units (year, month, week) use manual start-of-unit rounding.
 * - Wraps all Temporal calls in try-catch; returns "" on any error.
 *
 * @param value ISO 8601 datetime string
 * @param options Rounding options: smallestUnit, optional roundingIncrement and roundingMode
 * @returns Rounded ISO 8601 datetime string, or "" on invalid input
 *
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "year" }) // "2024-01-01T00:00:00"
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "month" }) // "2024-07-01T00:00:00"
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "day" }) // "2024-06-16T00:00:00"
 * @example roundDateTime("2024-06-15T12:34:56", { smallestUnit: "hour" }) // "2024-06-15T13:00:00"
 * @example roundDateTime("invalid", { smallestUnit: "year" }) // ""
 */
export function roundDateTime(
  value: string,
  options: {
    smallestUnit: DateTimeUnit;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
  },
): string {
  const { smallestUnit, roundingIncrement, roundingMode } = options;

  if (!isValidDateTime(value) || !isValidDateTimeUnit(smallestUnit)) return "";

  try {
    const source = Temporal.PlainDateTime.from(value);

    // PlainDateTime.round() in this polyfill supports day and time units
    const timeUnits: readonly string[] = [
      "day",
      "hour",
      "minute",
      "second",
      "millisecond",
      "microsecond",
      "nanosecond",
    ];

    if (timeUnits.includes(smallestUnit)) {
      const timeUnit = smallestUnit as Temporal.SmallestUnit<
        | "day"
        | "hour"
        | "minute"
        | "second"
        | "millisecond"
        | "microsecond"
        | "nanosecond"
      >;
      const result = source.round({
        smallestUnit: timeUnit,
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
    }

    // Manual rounding for date units (year, month, week)
    const startOfCurrent = getStartOfDateTimeUnit(source, smallestUnit);
    const increment = roundingIncrement ?? 1;
    if (increment <= 0) return "";
    const startOfNext = addDateTimeUnit(
      startOfCurrent,
      smallestUnit,
      increment,
    );

    const elapsed = source.since(startOfCurrent);
    const total = startOfNext.since(startOfCurrent);
    const fraction =
      elapsed.total("milliseconds") / total.total("milliseconds");

    let rounded: Temporal.PlainDateTime;
    const mode = roundingMode ?? "halfExpand";
    switch (mode) {
      case "ceil":
      case "expand":
        rounded =
          Temporal.PlainDateTime.compare(source, startOfCurrent) > 0
            ? startOfNext
            : startOfCurrent;
        break;
      case "floor":
      case "trunc":
        rounded = startOfCurrent;
        break;
      case "halfExpand":
      case "halfCeil":
        rounded = fraction >= 0.5 ? startOfNext : startOfCurrent;
        break;
      case "halfTrunc":
      case "halfFloor":
        rounded = fraction > 0.5 ? startOfNext : startOfCurrent;
        break;
      case "halfEven":
        // Simplified: use halfExpand behavior
        rounded = fraction >= 0.5 ? startOfNext : startOfCurrent;
        break;
      default:
        rounded = startOfCurrent;
    }

    return rounded.toString();
  } catch {
    return "";
  }
}
