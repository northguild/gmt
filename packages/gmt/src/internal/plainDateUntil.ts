import { Temporal } from "./temporal";
import type { RoundingOptions } from "../types";

/**
 * `start.until(end, { largestUnit, ...rounding })` for two PlainDates in the same calendar: the
 * polyfill's own `until`, whose date arithmetic and rounding follow TC39 `DifferenceTemporalPlainDate`.
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
  return start.until(end, {
    largestUnit: largestUnit as Temporal.DateUnit,
    smallestUnit: options?.smallestUnit,
    roundingIncrement: options?.roundingIncrement,
    roundingMode: options?.roundingMode,
  });
}
