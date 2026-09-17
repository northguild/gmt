// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import {
  addDateUnit,
  getDaysIntoDateUnit,
  getStartOfDateUnit,
  getStartOfNextDateUnit,
} from "../../internal/dateUnitHelpers";
import { measureNearRangeEnd } from "../../internal/measureNearRangeEnd";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { resolveManualRoundingOptions } from "../../internal/resolveManualRoundingOptions";
import type { DateUnit } from "../../types";
import { isValidDate, isValidDateUnit } from "../validate";
import { isObject } from "../../internal/isObject";

/**
 * Round an ISO 8601 date string to the specified date unit.
 *
 * - Returns "" for invalid inputs.
 * - Accepts date units: "year", "month", "week", "day", each in its singular or plural form
 *   ("month" or "months"), as Temporal's GetTemporalUnitValuedOption accepts both (§13.17).
 * - Time units ("hour", "minute", etc.) are rejected and return "".
 * - All date units use manual start-of-unit rounding. Weeks start on Monday.
 * - The rounding grid is anchored at the unit containing `value`, so `"halfEven"` breaks an exact
 *   tie towards that unit's start (multiple 0, the even one).
 * - The position within the unit is measured towards the next start, so a date in a unit that
 *   began before the first representable date (`-271821-04-19`) still rounds up to the next start.
 *   When it rounds down to that unrepresentable start, the result is "".
 * - In the last representable year (`+275760`) a date that rounds down still returns its unit's
 *   start; only rounding up past `+275760-09-13` returns "".
 * - `roundingIncrement` and `roundingMode` are read as Temporal reads them: a non-integer increment
 *   is truncated (`1.5` rounds by 1), an increment below 1 or not finite returns "", and a
 *   `roundingMode` outside Temporal's nine returns "" (previously it floored silently).
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
 * @example roundDate("2024-06-15", { smallestUnit: "months" }) // "2024-06-01" (plural unit name)
 * @example roundDate("-271821-04-19", { smallestUnit: "month" }) // "-271821-05-01" (the month began before the range)
 * @example roundDate("+275760-06-15", { smallestUnit: "year", roundingMode: "floor" }) // "+275760-01-01" (the next year is past the range)
 * @example roundDate("+275760-06-15", { smallestUnit: "year", roundingMode: "ceil" }) // "" (+275761-01-01 is past the range)
 * @example roundDate("2024-05-20", { smallestUnit: "month", roundingIncrement: 1.5 }) // "2024-06-01" (the increment truncates to 1)
 * @example roundDate("2024-05-20", { smallestUnit: "month", roundingMode: "bogus" as never }) // ""
 * @example roundDate("invalid", { smallestUnit: "year" }) // ""
 */
export function roundDate(
  value: string,
  options: {
    smallestUnit: Temporal.SmallestUnit<DateUnit>;
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

  if (!isValidDate(value) || !isValidDateUnit(smallestUnit)) return "";

  try {
    const source = Temporal.PlainDate.from(value);

    // Manual rounding for all date units (year, month, week, day)
    const resolved = resolveManualRoundingOptions(
      roundingIncrement,
      roundingMode,
    );
    if (resolved === null) return "";
    const { increment, mode } = resolved;

    // Measured towards the next start, never from the current one: at the first representable
    // date the current month or year began before the range, and only the next start exists. Each
    // start is built only when the mode needs it, and the unit's length is measured on a date in
    // the same place of its 400-year cycle when the next start lies after the last representable
    // date (+275760-09-13), where the current start may still be the answer.
    const elapsedDays = getDaysIntoDateUnit(source, smallestUnit);
    const startOfNextFrom = (from: Temporal.PlainDate): Temporal.PlainDate =>
      addDateUnit(
        getStartOfNextDateUnit(from, smallestUnit),
        smallestUnit,
        increment - 1,
      );
    const startOfNext = (): Temporal.PlainDate => startOfNextFrom(source);
    // Throws (so returns "") when the start lies outside the range.
    const startOfCurrent = (): Temporal.PlainDate =>
      getStartOfDateUnit(source, smallestUnit);
    const fraction = (): number =>
      elapsedDays /
      (elapsedDays +
        measureNearRangeEnd(source, (from) =>
          from.until(startOfNextFrom(from)).total("days"),
        ));

    let rounded: Temporal.PlainDate;
    switch (mode) {
      case "ceil":
      case "expand":
        rounded = elapsedDays > 0 ? startOfNext() : startOfCurrent();
        break;
      case "floor":
      case "trunc":
        rounded = startOfCurrent();
        break;
      case "halfExpand":
      case "halfCeil":
        rounded = fraction() >= 0.5 ? startOfNext() : startOfCurrent();
        break;
      case "halfTrunc":
      case "halfFloor":
        rounded = fraction() > 0.5 ? startOfNext() : startOfCurrent();
        break;
      case "halfEven":
        // Half-even breaks an exact tie towards the even multiple of the increment. The grid here
        // is anchored at the unit containing `source` — `startOfNext` counts the increment from
        // that unit, not from an absolute epoch — so the current start is multiple 0 and
        // `startOfNext` is multiple 1. The even multiple at a tie is therefore always the current
        // start. Above and below the tie it rounds to the nearer start, like every other half mode.
        rounded = fraction() > 0.5 ? startOfNext() : startOfCurrent();
        break;
    }

    return rounded.toString();
  } catch {
    return "";
  }
}
