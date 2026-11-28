import type { Temporal } from "../temporal";
import { assertMonthsInRange } from "./monthRange";

export type CalendarDateUnit = "year" | "month" | "week" | "day";

/** A date duration's four fields. */
export interface DateDurationFields {
  years: number;
  months: number;
  weeks: number;
  days: number;
}

function fieldsOf(duration: Temporal.Duration): DateDurationFields {
  return {
    years: duration.years,
    months: duration.months,
    weeks: duration.weeks,
    days: duration.days,
  };
}

/**
 * `one.until(two, { largestUnit })`'s date fields (TC39 `CalendarDateUntil`). Both dates must
 * carry the same calendar; a `largestUnit` that is not a date unit throws RangeError.
 */
export function calendarDateUntil(
  one: Temporal.PlainDate,
  two: Temporal.PlainDate,
  largestUnit: CalendarDateUnit,
): DateDurationFields {
  return fieldsOf(one.until(two, { largestUnit }));
}

/**
 * `date.add(duration, { overflow })` (TC39 `CalendarDateAdd`), after a month amount past the date
 * range throws without any arithmetic: `temporal-polyfill` throws for it too, but only after work
 * linear in the amount (D9, `monthRange.ts`).
 *
 * @returns a PlainDate in `date`'s calendar; throws RangeError out of range or on `reject`
 */
export function calendarDateAdd(
  date: Temporal.PlainDate,
  duration: Partial<DateDurationFields>,
  overflow: "constrain" | "reject",
): Temporal.PlainDate {
  assertMonthsInRange(duration.months);
  return date.add(duration, { overflow });
}
