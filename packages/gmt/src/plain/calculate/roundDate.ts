import { Temporal } from "@js-temporal/polyfill";
import {
  addDateUnit,
  getDaysIntoDateUnit,
  getStartOfDateUnit,
  getStartOfNextDateUnit,
} from "../../internal/dateUnitHelpers";
import type { DateUnit } from "../../types";
import { isValidDate, isValidDateUnit } from "../validate";

/**
 * Round an ISO 8601 date string to the specified date unit.
 *
 * - Returns "" for invalid inputs.
 * - Accepts date units: "year", "month", "week", "day".
 * - Time units ("hour", "minute", etc.) are rejected and return "".
 * - All date units use manual start-of-unit rounding. Weeks start on Monday.
 * - The position within the unit is measured towards the next start, so a date in a unit that
 *   began before the first representable date (`-271821-04-19`) still rounds up to the next start.
 *   When it rounds down to that unrepresentable start, the result is "".
 * - Wraps all Temporal calls in try-catch; returns "" on any error.
 *
 * @param value ISO 8601 date string
 * @param options Rounding options: smallestUnit, optional roundingIncrement and roundingMode
 * @returns Rounded ISO 8601 date string, or "" on invalid input
 *
 * @example roundDate("2024-06-15", { smallestUnit: "year" }) // "2024-01-01"
 * @example roundDate("2024-06-15", { smallestUnit: "month" }) // "2024-06-01" (14 of 30 days in: rounds down)
 * @example roundDate("2024-06-16", { smallestUnit: "month" }) // "2024-07-01" (half way: rounds up)
 * @example roundDate("2024-06-15", { smallestUnit: "week" }) // "2024-06-17" (a Saturday: the next Monday is closer)
 * @example roundDate("2024-06-15", { smallestUnit: "day" }) // "2024-06-15"
 * @example roundDate("-271821-04-19", { smallestUnit: "month" }) // "-271821-05-01" (the month began before the range)
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
    const increment = roundingIncrement ?? 1;
    if (increment <= 0) return "";

    // Measured towards the next start, never from the current one: at the first representable
    // date the current month or year began before the range, and only the next start exists.
    const startOfNext = addDateUnit(
      getStartOfNextDateUnit(source, smallestUnit),
      smallestUnit,
      increment - 1,
    );
    const elapsedDays = getDaysIntoDateUnit(source, smallestUnit);
    const totalDays = elapsedDays + source.until(startOfNext).total("days");
    const fraction = elapsedDays / totalDays;

    // Only built when chosen; throws (so returns "") when it lies before the range.
    const startOfCurrent = (): Temporal.PlainDate =>
      getStartOfDateUnit(source, smallestUnit);

    let rounded: Temporal.PlainDate;
    const mode = roundingMode ?? "halfExpand";
    switch (mode) {
      case "ceil":
      case "expand":
        rounded = elapsedDays > 0 ? startOfNext : startOfCurrent();
        break;
      case "floor":
      case "trunc":
        rounded = startOfCurrent();
        break;
      case "halfExpand":
      case "halfCeil":
        rounded = fraction >= 0.5 ? startOfNext : startOfCurrent();
        break;
      case "halfTrunc":
      case "halfFloor":
        rounded = fraction > 0.5 ? startOfNext : startOfCurrent();
        break;
      case "halfEven":
        // Simplified: use halfExpand behavior
        rounded = fraction >= 0.5 ? startOfNext : startOfCurrent();
        break;
      default:
        rounded = startOfCurrent();
    }

    return rounded.toString();
  } catch {
    return "";
  }
}
