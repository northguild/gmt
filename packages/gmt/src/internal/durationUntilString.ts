import type { Temporal } from "@js-temporal/polyfill";
import type { DurationStringOptions, RoundingOptions } from "../types";

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
export function durationUntilString(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate,
  largestUnit: string,
  options?: RoundingOptions<Temporal.DateUnit> & DurationStringOptions,
): string;
export function durationUntilString(
  start: Temporal.PlainDateTime,
  end: Temporal.PlainDateTime,
  largestUnit: string,
  options?: RoundingOptions<Temporal.DateTimeUnit> & DurationStringOptions,
): string;
export function durationUntilString(
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
  largestUnit: string,
  options?: RoundingOptions<Temporal.DateTimeUnit> & DurationStringOptions,
): string;
export function durationUntilString(
  start: Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime,
  end: Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime,
  largestUnit: string,
  options?: RoundingOptions<Temporal.DateTimeUnit> & DurationStringOptions,
): string {
  const duration = (
    start as {
      until(
        end:
          | Temporal.PlainDate
          | Temporal.PlainDateTime
          | Temporal.ZonedDateTime,
        opts: Record<string, unknown>,
      ): Temporal.Duration;
    }
  ).until(
    end as Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime,
    {
      largestUnit,
      smallestUnit: options?.smallestUnit,
      roundingIncrement: options?.roundingIncrement,
      roundingMode: options?.roundingMode,
    },
  );

  return duration.toString({
    smallestUnit: options?.toStringSmallestUnit,
    fractionalSecondDigits: options?.fractionalSecondDigits,
    roundingMode: options?.toStringRoundingMode,
  });
}
