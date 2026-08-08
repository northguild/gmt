import type { Temporal } from "@js-temporal/polyfill";
import type { DurationStringOptions, RoundingOptions } from "../types";

type UntilCapable<Self, Unit extends Temporal.DateTimeUnit> = {
  until(
    other: Self,
    options: {
      largestUnit: Temporal.LargestUnit<Unit>;
      smallestUnit?: Temporal.SmallestUnit<Unit>;
      roundingIncrement?: number;
      roundingMode?: Temporal.RoundingMode;
    },
  ): Temporal.Duration;
};

/**
 * Compute the ISO 8601 duration string between two Temporal objects via `.until()` + `.toString()`.
 *
 * Shared by the `diff*AsDuration` functions, which otherwise differ only in how their inputs are
 * validated and constructed.
 *
 * @param start Temporal object supporting `.until()` (PlainDate, PlainDateTime, or ZonedDateTime)
 * @param end the Temporal object to diff against
 * @param largestUnit the duration's largestUnit
 * @param options .until() rounding options and .toString() precision options
 * @returns ISO 8601 duration string
 */
export function durationUntilString<Self, Unit extends Temporal.DateTimeUnit>(
  start: UntilCapable<Self, Unit>,
  end: Self,
  largestUnit: Temporal.LargestUnit<Unit>,
  options?: RoundingOptions<Unit> & DurationStringOptions,
): string {
  const duration = start.until(end, {
    largestUnit,
    smallestUnit: options?.smallestUnit,
    roundingIncrement: options?.roundingIncrement,
    roundingMode: options?.roundingMode,
  });

  return duration.toString({
    smallestUnit: options?.toStringSmallestUnit,
    fractionalSecondDigits: options?.fractionalSecondDigits,
    roundingMode: options?.toStringRoundingMode,
  });
}
