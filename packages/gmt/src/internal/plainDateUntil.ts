import { Temporal } from "@js-temporal/polyfill";
import type { RoundingOptions } from "../types";
import {
  type CalendarDateUnit,
  calendarDateUntil,
  isCalendarArithmeticCompatNeeded,
} from "./temporalCompat";
import { plainDateUntilWithRounding } from "./zonedWallClockDifference";

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
  // No D11 term here. The nudge window can only miss its target when the target sits strictly
  // between the window bounds by a sub-day amount, which is why every D11 case carries a time
  // component. Two PlainDates have none, so the target always lands on a date the window already
  // reaches and the defect is unreachable through this function — measured over ~1.96M rows
  // against the raw polyfill, in both directions, with zero divergence (CORE-8 review, #253).
  if (
    start.calendarId === end.calendarId &&
    isCalendarArithmeticCompatNeeded(start.calendarId)
  ) {
    return plainDateUntilWithRounding(start, end, untilOptions);
  }
  return start.until(end, untilOptions);
}
