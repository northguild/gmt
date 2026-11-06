import type { DateTimeUnit, DurationRoundTo, TotalUnit } from "./temporalTypes";
import { Temporal } from "./temporal";
import type { DurationRelativeTo } from "../types";
import { assertMonthsInRange, timeZoneEquals } from "./temporalCompat";
import { zonedDateTimeFrom } from "./zonedWallClock";
import { isObject } from "./isObject";
import {
  isDateUnit,
  largerUnit,
  roundingSettings,
  timeZoneAnnotation,
  toUnit,
  untilAtLimit,
  defaultLargestUnit,
} from "./zonedDifference/operations";
import {
  originNeedsSpecPath,
  originRoundBySpec,
  originTotalBySpec,
} from "./zonedDifference/nudgeOrigin";
import type {
  DurationRoundOptions,
  RoundingSettings,
  ZonedDifferenceOptions,
} from "./zonedDifference/operations";

/*
 * ---------------------------------------------------------------------------------------------
 * Zoned differences, totals, rounding and comparison
 * ---------------------------------------------------------------------------------------------
 * `ZonedDateTime#until`, `Duration#total`, `Duration#round` and `Duration.compare` (with a zoned
 * `relativeTo`) are `temporal-polyfill` 1.0.8's own, with three additions:
 *
 * - the month-range guard (`assertMonthsInRange`, D9): with a `relativeTo`, a month amount past
 *   the date range throws before any arithmetic;
 * - `TimeZoneEquals` by primary identifier (`timeZoneEquals`, D19);
 * - an origin in a repeated hour is measured by the specification (D22), in
 *   `./zonedDifference/nudgeOrigin.ts`; called at the lines marked `// D22`.
 *
 * The TC39 operations D22 shares are in `./zonedDifference/operations.ts`.
 * ---------------------------------------------------------------------------------------------
 */

/** The zoned `relativeTo` Temporal would resolve, or null when it is not zoned. */
function zonedRelativeTo(
  relativeTo: DurationRelativeTo | undefined,
): Temporal.ZonedDateTime | null {
  if (relativeTo instanceof Temporal.ZonedDateTime) return relativeTo;

  try {
    if (typeof relativeTo === "string") {
      return timeZoneAnnotation.test(relativeTo)
        ? zonedDateTimeFrom(relativeTo)
        : null;
    }
    if (
      isObject(relativeTo) &&
      !(relativeTo instanceof Temporal.PlainDateTime) &&
      "timeZone" in relativeTo &&
      relativeTo.timeZone !== undefined
    ) {
      return zonedDateTimeFrom(relativeTo);
    }
  } catch {
    // Not a valid zoned relativeTo: the polyfill call reports it.
  }
  return null;
}

const CALENDAR_DIFFERENCE_UNITS: ReadonlySet<string> = new Set([
  "year",
  "years",
  "month",
  "months",
  "week",
  "weeks",
  "day",
  "days",
]);

/**
 * Whether Temporal's DifferenceTemporalZonedDateTime would reject `largestUnit` for this pair: a
 * calendar unit (day or larger) between two different time zones (TimeZoneEquals is false), because
 * "day lengths can vary between time zones due to DST". TimeZoneEquals compares primary
 * identifiers, so `UTC` equals `Etc/UTC` and `Asia/Calcutta` equals `Asia/Kolkata`
 * (`timeZoneEquals`, temporalCompat D19).
 *
 * @param one the start
 * @param two the end
 * @param largestUnit the requested `largestUnit`
 * @returns true when the pair cannot be differenced in `largestUnit`
 */
export function isCalendarDifferenceAcrossZones(
  one: Temporal.ZonedDateTime,
  two: Temporal.ZonedDateTime,
  largestUnit: string,
): boolean {
  if (!CALENDAR_DIFFERENCE_UNITS.has(largestUnit)) return false;
  return !timeZoneEquals(one, two);
}

/**
 * `ZonedDateTime#until`.
 *
 * @param one the start
 * @param two the end
 * @param options Temporal `largestUnit` / `smallestUnit` / `roundingIncrement` / `roundingMode`
 * @returns the difference; throws where TC39 Temporal throws for the rounding options. A calendar
 *   `largestUnit` across two time zones is not rejected here (TC39 DifferenceTemporalZonedDateTime
 *   throws a RangeError): callers gate it with `isCalendarDifferenceAcrossZones`.
 */
export function zonedUntil(
  one: Temporal.ZonedDateTime,
  two: Temporal.ZonedDateTime,
  options: ZonedDifferenceOptions = {},
): Temporal.Duration {
  const settings = roundingSettings(
    options.largestUnit,
    options.smallestUnit,
    (smallestUnit) => largerUnit("hour", smallestUnit),
    options.roundingIncrement,
    options.roundingMode ?? "trunc",
  );

  // D19: two identifiers of one zone (`UTC` and `Etc/UTC`) are one time zone, but a polyfill that
  // compares the identifiers as written rejects the pair ("Mismatching TimeZones"). The same
  // instant read in `one`'s identifier is the same value and the same zone by TimeZoneEquals.
  const end =
    one.timeZoneId !== two.timeZoneId && timeZoneEquals(one, two)
      ? two.withTimeZone(one.timeZoneId)
      : two;

  if (
    settings !== null &&
    untilTakesSpecPath(one, end, settings) && // D22
    timeZoneEquals(one, end)
  ) {
    const bySpec = untilAtLimit(one, end, options, settings); // D22
    if (bySpec !== null) return bySpec; // D22
  }

  return one.until(end, options);
}

/**
 * True when `until` must take the spec path because the runtime would answer wrongly, not throw:
 * a date `largestUnit` it would mismeasure, or for which the specification has no value
 * (`./zonedDifference/nudgeOrigin.ts`, D22).
 */
function untilTakesSpecPath(
  one: Temporal.ZonedDateTime,
  two: Temporal.ZonedDateTime,
  settings: RoundingSettings,
): boolean {
  return (
    one.calendarId === two.calendarId &&
    isDateUnit(settings.largestUnit) &&
    originNeedsSpecPath(one, two.epochNanoseconds) // D22
  );
}

/**
 * `Duration#total({ unit, relativeTo })`.
 *
 * @param duration the duration to total
 * @param unit the Temporal unit to total in
 * @param relativeTo Temporal `relativeTo`; a zoned one in a repeated hour takes the spec path
 * @returns the total; throws where TC39 Temporal throws
 */
export function durationTotal(
  duration: Temporal.Duration,
  unit: TotalUnit<DateTimeUnit>,
  relativeTo?: DurationRelativeTo,
): number {
  if (relativeTo !== undefined) {
    assertMonthsInRange(duration.months); // D9: with a relativeTo the months are added to it
  }
  const resolvedUnit = toUnit(unit);
  const bySpec =
    resolvedUnit === null
      ? null
      : originTotalBySpec(
          duration,
          unit,
          resolvedUnit,
          zonedRelativeTo(relativeTo),
        ); // D22
  return bySpec ?? duration.total({ unit, relativeTo });
}

/**
 * `Duration#round(roundTo)`.
 *
 * @param duration the duration to round
 * @param roundTo Temporal round options; a zoned `relativeTo` in a repeated hour takes the spec path
 * @returns the rounded duration; throws where TC39 Temporal throws
 */
export function durationRound(
  duration: Temporal.Duration,
  roundTo: DurationRoundOptions,
): Temporal.Duration {
  if (roundTo.relativeTo !== undefined) {
    assertMonthsInRange(duration.months); // D9
  }
  const settings = roundingSettings(
    roundTo.largestUnit,
    roundTo.smallestUnit,
    (smallestUnit) => largerUnit(defaultLargestUnit(duration), smallestUnit),
    roundTo.roundingIncrement,
    roundTo.roundingMode ?? "halfExpand",
  );
  const bySpec =
    settings === null
      ? null
      : originRoundBySpec(
          duration,
          roundTo,
          settings,
          zonedRelativeTo(roundTo.relativeTo),
        ); // D22
  return bySpec ?? duration.round(roundTo as DurationRoundTo);
}

const DURATION_FIELDS = [
  "years",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
  "microseconds",
  "nanoseconds",
] as const;

/** TC39 Duration.compare step 5: all ten fields equal (printing alike is not enough). */
function hasEqualFields(a: Temporal.Duration, b: Temporal.Duration): boolean {
  return DURATION_FIELDS.every((field) => a[field] === b[field]);
}

/**
 * `Temporal.Duration.compare(one, two, { relativeTo })`.
 *
 * @param one the first duration
 * @param two the second duration
 * @param relativeTo Temporal `relativeTo`
 * @returns -1, 0 or 1; throws where TC39 Temporal throws
 */
export function durationCompare(
  one: Temporal.Duration | string,
  two: Temporal.Duration | string,
  relativeTo?: DurationRelativeTo,
): number {
  const first = Temporal.Duration.from(one);
  const second = Temporal.Duration.from(two);
  if (hasEqualFields(first, second)) {
    // TC39 Temporal.Duration.compare: equal fields are +0 before relativeTo is read for arithmetic.
    return 0;
  }
  // D9: past the date range, the months added to relativeTo throw in the specification.
  assertMonthsInRange(first.months);
  assertMonthsInRange(second.months);
  return Temporal.Duration.compare(first, second, { relativeTo });
}
