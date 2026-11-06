import type { RoundingMode, SmallestUnit } from "./temporalTypes";
import { Temporal } from "./temporal";
import type { Disambiguation, Offset, Overflow } from "../types";
import { assertMonthsInRange, calendarDateAdd } from "./temporalCompat";
import { isValidEpoch } from "./zonedWallClock";
import type { DATE_TIME_FIELDS, SetFields } from "./readSetFields";

/*
 * Thin wrappers over the `ZonedDateTime` operations that resolve a wall clock or a start of day.
 * `temporal-polyfill` 1.0.8 answers each correctly across the whole representable range and in
 * every calendar GMT supports, so they call it directly. What stays is what Temporal has no option
 * for: an intermediate wall clock resolved with a caller-chosen `disambiguation`
 * (`addToZonedDisambiguated`), and the month-range guard (`assertMonthsInRange`, D9), which runs
 * before any arithmetic so an out-of-range month amount throws at once.
 */

const DISAMBIGUATION_PROBE = new Temporal.PlainDateTime(2000, 1, 1);
/** An ISO date far from the limits, used only to validate an `overflow` option. */
const OVERFLOW_PROBE = new Temporal.PlainDate(2000, 1, 1);

type RoundingSmallestUnit = SmallestUnit<
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "microsecond"
  | "nanosecond"
>;

interface ZonedRoundTo {
  smallestUnit: RoundingSmallestUnit;
  roundingIncrement?: number;
  roundingMode?: RoundingMode;
}

function inZoneOf(
  epochNanoseconds: bigint,
  zoned: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime {
  return new Temporal.ZonedDateTime(
    epochNanoseconds,
    zoned.timeZoneId,
    zoned.calendarId,
  );
}

/**
 * `PlainDate#toZonedDateTime(timeZone)` (start of day) or
 * `PlainDateTime#toZonedDateTime(timeZone, { disambiguation })`.
 *
 * @param plain the date (resolved to its start of day) or date-time to place in `timeZone`
 * @param timeZone IANA identifier, offset time zone, or RFC 9557 string carrying one
 * @param disambiguation Temporal disambiguation for a PlainDateTime (ignored for a PlainDate)
 * @returns the resolved Temporal.ZonedDateTime; throws where TC39 Temporal throws
 */
export function plainToZoned(
  plain: Temporal.PlainDate | Temporal.PlainDateTime,
  timeZone: string,
  disambiguation?: Disambiguation,
): Temporal.ZonedDateTime {
  return plain instanceof Temporal.PlainDate
    ? plain.toZonedDateTime(timeZone)
    : plain.toZonedDateTime(timeZone, { disambiguation });
}

/**
 * `ZonedDateTime#startOfDay`.
 *
 * @param zoned the value whose local day to start
 * @returns the first valid wall-clock time of that day; throws where TC39 Temporal throws
 */
export function zonedStartOfDay(
  zoned: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime {
  return zoned.startOfDay();
}

/**
 * `ZonedDateTime#withPlainTime`.
 *
 * @param zoned the value whose local date to keep
 * @param time the new wall-clock time; omitted means the start of the day
 * @returns the resolved Temporal.ZonedDateTime; throws where TC39 Temporal throws
 */
export function zonedWithPlainTime(
  zoned: Temporal.ZonedDateTime,
  time?: Temporal.PlainTime | Temporal.PlainTimeLike | string,
): Temporal.ZonedDateTime {
  return zoned.withPlainTime(time);
}

/**
 * `ZonedDateTime#hoursInDay`.
 *
 * @param zoned the value whose local day to measure
 * @returns hours from this day's start to the next day's start; throws where TC39 Temporal throws
 */
export function zonedHoursInDay(zoned: Temporal.ZonedDateTime): number {
  return zoned.hoursInDay;
}

/** `transition` unless it is null or lies outside the caller's limit. */
function withinLimit(
  transition: Temporal.ZonedDateTime | null,
  isInside: (epochNanoseconds: bigint) => boolean,
): Temporal.ZonedDateTime | null {
  return transition !== null && isInside(transition.epochNanoseconds)
    ? transition
    : null;
}

/**
 * `ZonedDateTime#getTimeZoneTransition("next")`: the first offset change strictly after `zoned`.
 *
 * @param zoned the instant to search after (exclusive)
 * @param until optional: the last instant to search, in epoch nanoseconds (inclusive). A change
 *   after it is not reported
 * @returns the next transition, or null when there is none up to `until` or, without it, none
 *   that Temporal reports
 */
export function zonedNextTransition(
  zoned: Temporal.ZonedDateTime,
  until?: bigint,
): Temporal.ZonedDateTime | null {
  const next = zoned.getTimeZoneTransition("next");
  return until === undefined
    ? next
    : withinLimit(next, (epochNanoseconds) => epochNanoseconds <= until);
}

/**
 * `ZonedDateTime#getTimeZoneTransition("previous")`: the last offset change strictly before `zoned`.
 *
 * @param zoned the instant to search before (exclusive)
 * @param since optional: where the search stops, in epoch nanoseconds (exclusive). A change at or
 *   before it is not reported
 * @returns the previous transition, or null when there is none after `since` or, without it, none
 */
export function zonedPreviousTransition(
  zoned: Temporal.ZonedDateTime,
  since?: bigint,
): Temporal.ZonedDateTime | null {
  const previous = zoned.getTimeZoneTransition("previous");
  return since === undefined
    ? previous
    : withinLimit(previous, (epochNanoseconds) => epochNanoseconds > since);
}

// ---------------------------------------------------------------------------------------------
// add / subtract
// ---------------------------------------------------------------------------------------------

function hasDateUnits(duration: Temporal.Duration): boolean {
  return (
    duration.years !== 0 ||
    duration.months !== 0 ||
    duration.weeks !== 0 ||
    duration.days !== 0
  );
}

function timeUnitsNanoseconds(duration: Temporal.Duration): bigint {
  return (
    BigInt(duration.hours) * 3_600_000_000_000n +
    BigInt(duration.minutes) * 60_000_000_000n +
    BigInt(duration.seconds) * 1_000_000_000n +
    BigInt(duration.milliseconds) * 1_000_000n +
    BigInt(duration.microseconds) * 1_000n +
    BigInt(duration.nanoseconds)
  );
}

/**
 * TC39 §6.5.5 `AddZonedDateTime` for a signed duration with calendar units: `CalendarDateAdd` runs
 * in `calendarDateAdd` (`temporalCompat`, which applies the month-range guard); the intermediate wall clock (added
 * date, original time) resolves with `GetEpochNanosecondsFor(timeZone, dateTime, disambiguation)`
 * through GMT's own `plainToZoned`, so a gap or an overlap landing honours `disambiguation`; the
 * time units are then added in exact time and never re-resolved.
 */
function addDateThenTime(
  zoned: Temporal.ZonedDateTime,
  duration: Temporal.Duration,
  overflow: Overflow,
  disambiguation: Disambiguation,
): Temporal.ZonedDateTime {
  // Validates `overflow` exactly as ZonedDateTime#add does.
  OVERFLOW_PROBE.add({ days: 0 }, { overflow });

  const wall = zoned.toPlainDateTime();
  const { years, months, weeks, days } = duration;
  const date = calendarDateAdd(
    wall.toPlainDate(),
    { years, months, weeks, days },
    overflow === undefined ? "constrain" : overflow,
  );
  const intermediate = plainToZoned(
    date.toPlainDateTime(wall.toPlainTime()),
    zoned.timeZoneId,
    disambiguation,
  );
  const result = intermediate.epochNanoseconds + timeUnitsNanoseconds(duration);
  if (!isValidEpoch(result)) {
    throw new RangeError(
      `${zoned.toString()} + ${duration.toString()} is outside the supported range`,
    );
  }
  return inZoneOf(result, zoned);
}

/**
 * `ZonedDateTime#add`.
 *
 * @param zoned the starting value
 * @param duration the duration to add
 * @param options Temporal `overflow` for the calendar part
 * @returns the sum; throws where TC39 Temporal throws
 */
export function addToZoned(
  zoned: Temporal.ZonedDateTime,
  duration: Temporal.Duration | Temporal.DurationLikeObject | string,
  options?: { overflow?: Overflow },
): Temporal.ZonedDateTime {
  assertMonthsInRange(Temporal.Duration.from(duration).months); // D9
  return zoned.add(duration, options);
}

/**
 * `ZonedDateTime#subtract`.
 *
 * @param zoned the starting value
 * @param duration the duration to subtract
 * @param options Temporal `overflow` for the calendar part
 * @returns the difference; throws where TC39 Temporal throws
 */
export function subtractFromZoned(
  zoned: Temporal.ZonedDateTime,
  duration: Temporal.Duration | Temporal.DurationLikeObject | string,
  options?: { overflow?: Overflow },
): Temporal.ZonedDateTime {
  assertMonthsInRange(Temporal.Duration.from(duration).months); // D9
  return zoned.subtract(duration, options);
}

/**
 * `addToZoned` / `subtractFromZoned` with a caller-chosen `disambiguation` for the intermediate
 * wall-clock date-time — TC39 Temporal §6.5.5 AddZonedDateTime with the "compatible" argument of
 * its `GetEpochNanosecondsFor` step replaced by `disambiguation`.
 *
 * - The date portion (years, months, weeks, days) is added to the wall-clock date, keeping the
 *   wall-clock time. That intermediate date-time is resolved with `disambiguation` whenever it is
 *   not a single instant: in a fall-back overlap "earlier"/"compatible" take the earlier instant and
 *   "later" the later one; in a spring-forward gap "earlier" shifts it back by the gap length and
 *   "later"/"compatible" forward (DisambiguatePossibleEpochNanoseconds); "reject" throws for both.
 * - The time portion is then added in exact time and is never re-resolved.
 * - With no date portion, the whole duration is exact time and `disambiguation` never applies.
 * - Each option is converted to a string once, as Temporal GetOption converts it.
 *
 * @param zoned the starting value
 * @param duration the duration to add or subtract
 * @param sign 1 to add, -1 to subtract
 * @param options Temporal `overflow` for the calendar part and `disambiguation`
 * @returns the result; throws where TC39 Temporal throws, or when "reject" meets a gap or overlap
 */
export function addToZonedDisambiguated(
  zoned: Temporal.ZonedDateTime,
  duration: Temporal.Duration | Temporal.DurationLikeObject | string,
  sign: 1 | -1,
  options: {
    overflow?: Overflow;
    disambiguation: Disambiguation;
  },
): Temporal.ZonedDateTime {
  // Temporal GetOption converts each option once (ToString). The steps below check an option and
  // then use it, some more than once, so both are converted here and every step sees the same
  // string: an option given as an object cannot answer the check one way and the use another.
  const overflow =
    options.overflow === undefined
      ? undefined
      : (`${options.overflow}` as Overflow);
  const disambiguation = `${options.disambiguation}` as Disambiguation;
  // Validates `disambiguation` even when no wall clock is resolved below.
  DISAMBIGUATION_PROBE.toZonedDateTime("UTC", { disambiguation });
  const parsed = Temporal.Duration.from(duration);
  assertMonthsInRange(parsed.months); // D9

  if (disambiguation === "compatible" || !hasDateUnits(parsed)) {
    const step = sign === 1 ? addToZoned : subtractFromZoned;
    return step(zoned, parsed, { overflow });
  }

  return addDateThenTime(
    zoned,
    sign === 1 ? parsed : parsed.negated(),
    overflow,
    disambiguation,
  );
}

// ---------------------------------------------------------------------------------------------
// with / round
// ---------------------------------------------------------------------------------------------

interface ZonedWithOptions {
  overflow?: Overflow;
  disambiguation?: Disambiguation;
  offset?: Offset;
}

/** The date and time fields a `set*` function passes, as `readSetFields` checked them. */
type ZonedWithFields = SetFields<(typeof DATE_TIME_FIELDS)[number]>;

/**
 * `ZonedDateTime#with`.
 *
 * @param zoned the value to change
 * @param fields the date and time fields to set
 * @param options Temporal `overflow` / `disambiguation` / `offset` (default `"prefer"`)
 * @returns the changed value; throws where TC39 Temporal throws
 */
export function withZonedFields(
  zoned: Temporal.ZonedDateTime,
  fields: ZonedWithFields,
  options?: ZonedWithOptions,
): Temporal.ZonedDateTime {
  return zoned.with(fields, options);
}

/**
 * `ZonedDateTime#round`.
 *
 * @param zoned the value to round
 * @param options Temporal `smallestUnit` (day or smaller) / `roundingIncrement` / `roundingMode`
 * @returns the rounded value; throws where TC39 Temporal throws
 */
export function roundZonedDateTime(
  zoned: Temporal.ZonedDateTime,
  options: ZonedRoundTo,
): Temporal.ZonedDateTime {
  return zoned.round(options);
}
