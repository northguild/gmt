import { Temporal } from "./temporal";
import type { DurationRelativeTo } from "../types";
import {
  isCalendarArithmeticCompatNeeded,
  isNudgeWindowCompatNeeded,
  timeZoneEquals,
} from "./temporalCompat";
import { zonedDateTimeFrom } from "./zonedWallClock";
import { isObject } from "./isObject";
import {
  compareAtLimit,
  defaultLargestUnit,
  isDateUnit,
  largerUnit,
  roundAtLimit,
  roundingSettings,
  timeZoneAnnotation,
  toUnit,
  totalAtLimit,
  untilAtLimit,
} from "./zonedDifference/operations";
import {
  UNIT_REACH,
  durationReach,
  reachesRangeLimit,
  roundingReach,
  runAtRangeLimit,
} from "./zonedDifference/rangeLimit";
import {
  calendarCompareBySpec,
  calendarRoundBySpec,
  calendarTotalBySpec,
} from "./zonedDifference/calendarArithmetic";
export { plainDateUntilWithRounding } from "./zonedDifference/calendarArithmetic"; // defect 3
import {
  originNeedsSpecPath,
  originRoundBySpec,
  originTotalBySpec,
} from "./zonedDifference/nudgeOrigin";
import {
  isNudgeWindowUnit,
  monthRoundBySpec,
  monthTotalBySpec,
} from "./zonedDifference/nudgeWindow";
export { plainUntilWithRounding } from "./zonedDifference/nudgeWindow"; // defect 4
import type {
  DurationRoundOptions,
  RoundingSettings,
  Unit,
  ZonedDifferenceOptions,
} from "./zonedDifference/operations";

/*
 * ---------------------------------------------------------------------------------------------
 * WHY THIS FILE EXISTS — zoned differences, totals, rounding and comparison at the range limits
 * ---------------------------------------------------------------------------------------------
 * `ZonedDateTime#until`, `Duration#total`, `Duration#round` and `Duration.compare` (with a zoned
 * `relativeTo`) resolve wall clocks internally, so two `@js-temporal/polyfill` 0.5.1 defects reach
 * them. Every wrapper below calls the polyfill first and returns its result unchanged; a fallback
 * runs only when the exact times involved, widened by the largest window the operation can
 * consult, reach within two days of a range limit.
 *
 * 1. **Wall-clock clamp** (defect 1 in `./zonedWallClock.ts`). `zoned.A` — lives in
 *    `./zonedDifference/rangeLimit.ts`; called through `runAtRangeLimit` and the `*AtLimit`
 *    arguments marked `// defect 1`.
 * 2. **UTC fast path without a validity check.** `zoned.D` — lives in
 *    `./zonedDifference/utcValidity.ts`; called from `runAtRangeLimit`.
 * 3. **Non-ISO calendar arithmetic** (CORE-6 D1–D7, see `./temporalCompat/README.md`). Lives in
 *    `./zonedDifference/calendarArithmetic.ts`; called at the lines marked `// defect 3`.
 * 4. **The calendar nudge window is never retried** (D11). Lives in
 *    `./zonedDifference/nudgeWindow.ts`; called at the lines marked `// defect 4`.
 * 5. **An origin in a repeated hour is measured from the wrong instant** (D22). Lives in
 *    `./zonedDifference/nudgeOrigin.ts`; called at the lines marked `// defect 5`.
 *
 * The TC39 operations these share are in `./zonedDifference/operations.ts`, which goes with the
 * last of them.
 * ---------------------------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------------------------
// Polyfill-first wrappers
// ---------------------------------------------------------------------------------------------

function inTimeZone(
  zoned: Temporal.ZonedDateTime,
  timeZone: string,
): Temporal.ZonedDateTime {
  return zoned.timeZoneId === timeZone ? zoned : zoned.withTimeZone(timeZone);
}

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
 * `ZonedDateTime#until`, correct at the range limits (see the note at the top of this file).
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
  // TimeZoneEquals runs at most once per call, and only after the cheaper conditions need it.
  let sameZone: boolean | undefined;
  const inSameZone = (): boolean => (sameZone ??= timeZoneEquals(one, two));

  if (
    settings !== null &&
    untilTakesSpecPath(one, two, settings) && // defects 3–5
    inSameZone()
  ) {
    const bySpec = untilAtLimit(one, two, options, settings); // defects 3–5
    if (bySpec !== null) return bySpec; // defects 3–5
  }

  const atRangeLimit =
    settings !== null &&
    reachesRangeLimit(
      [one.epochNanoseconds, two.epochNanoseconds],
      roundingReach(settings),
    ) &&
    inSameZone();

  return runAtRangeLimit(
    // defects 1 and 2
    one.timeZoneId,
    atRangeLimit,
    (timeZone) =>
      inTimeZone(one, timeZone).until(inTimeZone(two, timeZone), options),
    () => untilAtLimit(one, two, options, settings as RoundingSettings), // defect 1
  );
}

/**
 * True when `until` must take the spec path because the polyfill would answer wrongly, not throw.
 *
 * Defect 3: a calendar whose arithmetic the polyfill gets wrong (D6 is a wrong month end). Defect 4:
 * a calendar `smallestUnit` from a day that a month add would constrain. Defect 5
 * (`./zonedDifference/nudgeOrigin.ts`): a date `largestUnit` the runtime would mismeasure, or for
 * which the specification has no value. The last of the three terms to go takes this function with
 * it, along with the `// defects 3–5` block in `zonedUntil`.
 */
function untilTakesSpecPath(
  one: Temporal.ZonedDateTime,
  two: Temporal.ZonedDateTime,
  settings: RoundingSettings,
): boolean {
  return (
    one.calendarId === two.calendarId &&
    (isCalendarArithmeticCompatNeeded(one.calendarId) || // defect 3
      (isNudgeWindowUnit(settings.smallestUnit) &&
        one.day >= 29 &&
        isNudgeWindowCompatNeeded()) || // defect 4
      (isDateUnit(settings.largestUnit) &&
        originNeedsSpecPath(one, two.epochNanoseconds))) // defect 5
  );
}

/**
 * `Duration#total({ unit, relativeTo })`, correct at the range limits and in calendars the
 * polyfill gets wrong.
 *
 * @param duration the duration to total
 * @param unit the Temporal unit to total in
 * @param relativeTo Temporal `relativeTo`; a zoned one reaches the range-limit fallbacks, and a
 *   zoned or plain one in a calendar that needs the compat layer takes the spec path
 * @returns the total; throws where TC39 Temporal throws
 */
export function durationTotal(
  duration: Temporal.Duration,
  unit: Temporal.TotalUnit<Temporal.DateTimeUnit>,
  relativeTo?: DurationRelativeTo,
): number {
  const zoned = zonedRelativeTo(relativeTo);
  const resolvedUnit = toUnit(unit);
  // Defect 3, then defect 4 (the month fraction when the day can be constrained), then defect 5.
  // The `bySpec` statement and the `if` after it go with the last of the three.
  const bySpec =
    resolvedUnit === null
      ? null
      : (calendarTotalBySpec(duration, unit, resolvedUnit, relativeTo, zoned) ?? // defect 3
        monthTotalBySpec(duration, unit, resolvedUnit, relativeTo, zoned) ?? // defect 4
        originTotalBySpec(duration, unit, resolvedUnit, zoned)); // defect 5
  if (bySpec !== null) {
    return bySpec;
  }
  if (zoned === null) {
    return duration.total({ unit, relativeTo });
  }

  const atRangeLimit =
    resolvedUnit !== null &&
    reachesRangeLimit(
      [zoned.epochNanoseconds],
      durationReach(duration) + UNIT_REACH[resolvedUnit],
    );

  return runAtRangeLimit(
    // defects 1 and 2
    zoned.timeZoneId,
    atRangeLimit,
    (timeZone) =>
      duration.total({ unit, relativeTo: inTimeZone(zoned, timeZone) }),
    () => totalAtLimit(duration, zoned, unit, resolvedUnit as Unit), // defect 1
  );
}

/**
 * `Duration#round(roundTo)`, correct at the range limits.
 *
 * @param duration the duration to round
 * @param roundTo Temporal round options; only a zoned `relativeTo` reaches the fallbacks
 * @returns the rounded duration; throws where TC39 Temporal throws
 */
export function durationRound(
  duration: Temporal.Duration,
  roundTo: DurationRoundOptions,
): Temporal.Duration {
  const zoned = zonedRelativeTo(roundTo.relativeTo);
  const settings = roundingSettings(
    roundTo.largestUnit,
    roundTo.smallestUnit,
    (smallestUnit) => largerUnit(defaultLargestUnit(duration), smallestUnit),
    roundTo.roundingIncrement,
    roundTo.roundingMode ?? "halfExpand",
  );
  // Defect 3, then defect 4 (the nudge window when the day can be constrained), then defect 5.
  // The `bySpec` statement and the `if` after it go with the last of the three.
  const bySpec =
    settings === null
      ? null
      : (calendarRoundBySpec(duration, roundTo, settings, zoned) ?? // defect 3
        monthRoundBySpec(duration, roundTo, settings, zoned) ?? // defect 4
        originRoundBySpec(duration, roundTo, settings, zoned)); // defect 5
  if (bySpec !== null) {
    return bySpec;
  }

  if (zoned === null) {
    return duration.round(roundTo as Temporal.DurationRoundTo);
  }

  const atRangeLimit =
    settings !== null &&
    reachesRangeLimit(
      [zoned.epochNanoseconds],
      durationReach(duration) + roundingReach(settings),
    );

  return runAtRangeLimit(
    // defects 1 and 2
    zoned.timeZoneId,
    atRangeLimit,
    (timeZone) =>
      duration.round({
        ...roundTo,
        relativeTo: inTimeZone(zoned, timeZone),
      } as Temporal.DurationRoundTo),
    () => roundAtLimit(duration, zoned, roundTo, settings as RoundingSettings), // defect 1
  );
}

/**
 * `Temporal.Duration.compare(one, two, { relativeTo })`, correct at the range limits.
 *
 * @param one the first duration
 * @param two the second duration
 * @param relativeTo Temporal `relativeTo`; only a zoned one reaches the fallbacks
 * @returns -1, 0 or 1; throws where TC39 Temporal throws
 */
export function durationCompare(
  one: Temporal.Duration | string,
  two: Temporal.Duration | string,
  relativeTo?: DurationRelativeTo,
): number {
  const zoned = zonedRelativeTo(relativeTo);
  // defect 3: this statement and the `if` below go together.
  const bySpec = calendarCompareBySpec(one, two, relativeTo, zoned); // defect 3
  if (bySpec !== null) {
    // defect 3 (the `if` and its block)
    return bySpec;
  }
  if (zoned === null) {
    return Temporal.Duration.compare(one, two, { relativeTo });
  }

  const first = Temporal.Duration.from(one);
  const second = Temporal.Duration.from(two);
  const reach =
    durationReach(first) > durationReach(second)
      ? durationReach(first)
      : durationReach(second);

  return runAtRangeLimit(
    // defects 1 and 2
    zoned.timeZoneId,
    reachesRangeLimit([zoned.epochNanoseconds], reach),
    (timeZone) =>
      Temporal.Duration.compare(first, second, {
        relativeTo: inTimeZone(zoned, timeZone),
      }),
    () => compareAtLimit(first, second, zoned), // defect 1
  );
}
