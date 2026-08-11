import { Temporal } from "@js-temporal/polyfill";
import {
  addDateUnit,
  getStartOfDateUnit,
} from "../../internal/dateUnitHelpers";
import type { DateUnit } from "../../types";
import { isValidDate, isValidDateUnit } from "../validate";

/**
 * Round an ISO 8601 date string to the specified date unit.
 *
 * - Returns "" for invalid inputs.
 * - Accepts date units: "year", "month", "week", "day".
 * - Time units ("hour", "minute", etc.) are rejected and return "".
 * - All date units use manual start-of-unit rounding.
 * - Wraps all Temporal calls in try-catch; returns "" on any error.
 *
 * @param value ISO 8601 date string
 * @param options Rounding options: smallestUnit, optional roundingIncrement and roundingMode
 * @returns Rounded ISO 8601 date string, or "" on invalid input
 *
 * @example roundDate("2024-06-15", { smallestUnit: "year" }) // "2024-01-01"
 * @example roundDate("2024-06-15", { smallestUnit: "month" }) // "2024-07-01"
 * @example roundDate("2024-06-15", { smallestUnit: "week" }) // "2024-06-16"
 * @example roundDate("2024-06-15", { smallestUnit: "day" }) // "2024-06-15"
 * @example roundDate("invalid", { smallestUnit: "year" }) // ""
 */
export function roundDate(
  value: string,
  options: {
    smallestUnit: DateUnit;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
  },
): string {
  const { smallestUnit, roundingIncrement, roundingMode } = options;

  if (!isValidDate(value) || !isValidDateUnit(smallestUnit)) return "";

  try {
    const source = Temporal.PlainDate.from(value);

    // Manual rounding for all date units (year, month, week, day)
    const startOfCurrent = getStartOfDateUnit(source, smallestUnit);
    const increment = roundingIncrement ?? 1;
    if (increment <= 0) return "";
    const startOfNext = addDateUnit(startOfCurrent, smallestUnit, increment);

    const elapsed = source.since(startOfCurrent);
    const total = startOfNext.since(startOfCurrent);
    const fraction = elapsed.total("days") / total.total("days");

    let rounded: Temporal.PlainDate;
    const mode = roundingMode ?? "halfExpand";
    switch (mode) {
      case "ceil":
      case "expand":
        rounded =
          Temporal.PlainDate.compare(source, startOfCurrent) > 0
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
