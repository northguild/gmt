import { Temporal } from "@js-temporal/polyfill";
import type { RoundingOptions } from "../types";
import {
  type CalendarDateUnit,
  calendarDateUntil,
  isCalendarArithmeticCompatNeeded,
  isNudgeWindowCompatNeeded,
} from "./temporalCompat";
import { plainDateUntilWithRounding } from "./zonedWallClockDifference";

/** Month and year are the units whose nudge window can miss its target; see D11. */
function isNudgeWindowSmallestUnit(unit: unknown): boolean {
  return (
    unit === "month" || unit === "months" || unit === "year" || unit === "years"
  );
}

/** Plural date units to Temporal's singular spelling; anything else passes through unchanged. */
function singularDateUnit(unit: string): CalendarDateUnit {
  return (unit.endsWith("s") ? unit.slice(0, -1) : unit) as CalendarDateUnit;
}

/**
 * `start.until(end, { largestUnit, ...rounding })` for two PlainDates in the same calendar.
 *
 * - Without rounding options the difference goes through the Temporal compat layer's
 *   `calendarDateUntil`, which is the polyfill's own `until` for `iso8601` and the TC39
 *   `NonISODateUntil` answer for other calendars (CORE-6 D1, D6, D7 and the corrected calendars).
 * - With `smallestUnit`, `roundingIncrement` or `roundingMode`, a calendar whose compat is needed
 *   goes through `plainDateUntilWithRounding` (TC39 `DifferenceTemporalPlainDate` in the plain
 *   context, `GetUTCEpochNanoseconds`); every other calendar is the polyfill's own `until`.
 *
 * @param start PlainDate the difference starts from
 * @param end PlainDate in the same calendar
 * @param largestUnit a date unit, singular or plural
 * @param options optional DifferenceOptions rounding controls
 * @returns the difference as a Temporal.Duration; throws RangeError on invalid input
 *
 * @example plainDateUntil(Temporal.PlainDate.from("2024-01-31"), Temporal.PlainDate.from("2024-03-01"), "months").toString() // "P1M1D"
 */
export function plainDateUntil(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate,
  largestUnit: string,
  options?: RoundingOptions<Temporal.DateUnit>,
): Temporal.Duration {
  if (
    options?.smallestUnit === undefined &&
    options?.roundingIncrement === undefined &&
    options?.roundingMode === undefined
  ) {
    return Temporal.Duration.from(
      calendarDateUntil(start, end, singularDateUnit(largestUnit)),
    );
  }
  const untilOptions = {
    largestUnit: largestUnit as Temporal.DateUnit,
    smallestUnit: options.smallestUnit,
    roundingIncrement: options.roundingIncrement,
    roundingMode: options.roundingMode,
  };
  if (
    start.calendarId === end.calendarId &&
    (isCalendarArithmeticCompatNeeded(start.calendarId) ||
      // Defect 4 (D11): the polyfill rounds over a nudge window that need not contain the end, and
      // only a start past the 28th with a month or year `smallestUnit` can reach that.
      (start.day >= 29 &&
        isNudgeWindowSmallestUnit(options.smallestUnit) &&
        isNudgeWindowCompatNeeded()))
  ) {
    return plainDateUntilWithRounding(start, end, untilOptions);
  }
  return start.until(end, untilOptions);
}
