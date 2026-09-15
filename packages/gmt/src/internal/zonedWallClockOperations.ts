import { Temporal } from "@js-temporal/polyfill";
import type { Disambiguation, Offset, Overflow } from "../types";
import { MAX_EPOCH_NANOSECONDS } from "./epochNanoseconds";
import {
  calendarDateAdd,
  isCalendarArithmeticCompatNeeded,
} from "./temporalCompat";
import {
  type CarriedOffset,
  epochNanosecondsFor,
  interpretISODateTimeOffset,
  isNamedTimeZone,
  isNearRangeEdge,
  isValidEpoch,
  MAX_TRANSITIONS_BEFORE_MAXIMUM,
  NEXT_TRANSITION_HORIZON_NANOSECONDS,
  startOfDayEpochNanoseconds,
  timeZoneIdOf,
  utcOffsetStringNanoseconds,
} from "./zonedWallClock";

/*
 * Polyfill-first wrappers for the Temporal operations that resolve a wall clock or a start of day
 * inside `@js-temporal/polyfill` 0.5.1, and so inherit its range-limit defects. See the note at the
 * top of `./zonedWallClock.ts` (defect 1: fixed on upstream main by 05ce7a3 at the maximum and
 * 95237e0 at the minimum, both unreleased; defect 2 is unfixed upstream): each fallback is removed
 * once a polyfill release fixing its defect at BOTH limits is GMT's dependency floor. 05ce7a3 alone
 * never retires the defect-1 fallbacks, because the `zoned.A` canary's `min.*` probes still fail
 * with it.
 *
 * Every wrapper returns the polyfill's own result whenever it has one, and re-throws the polyfill's
 * own error unless the zone is a named, non-UTC zone and the wall clock being resolved lies within
 * a month of either range limit — the only inputs either defect reaches.
 */

const NANOSECONDS_PER_HOUR = 3_600_000_000_000;
const DISAMBIGUATION_PROBE = new Temporal.PlainDateTime(2000, 1, 1);
/** An ISO date far from the limits, used only to validate an `overflow` option. */
const OVERFLOW_PROBE = new Temporal.PlainDate(2000, 1, 1);

type RoundingSmallestUnit = Temporal.SmallestUnit<
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
  roundingMode?: Temporal.RoundingMode;
}

/** Re-throws `error` unless `recover` computes a TC39 result (it returns null when out of scope). */
function recoverAtRangeEdge<T>(error: unknown, recover: () => T | null): T {
  const recovered = recover();
  if (recovered === null) {
    throw error;
  }
  return recovered;
}

function isAtRangeEdge(timeZone: string, date: Temporal.PlainDate): boolean {
  return isNamedTimeZone(timeZone) && isNearRangeEdge(date);
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

// ---------------------------------------------------------------------------------------------
// PlainDate / PlainDateTime -> ZonedDateTime
// ---------------------------------------------------------------------------------------------

function plainToZonedAtEdge(
  plain: Temporal.PlainDate | Temporal.PlainDateTime,
  timeZoneLike: string,
  disambiguation: Disambiguation,
): Temporal.ZonedDateTime | null {
  let timeZone: string;
  try {
    timeZone = timeZoneIdOf(timeZoneLike);
    DISAMBIGUATION_PROBE.toZonedDateTime("UTC", { disambiguation });
  } catch {
    return null;
  }

  const isDate = plain instanceof Temporal.PlainDate;
  const date = isDate ? plain : plain.toPlainDate();
  if (!isAtRangeEdge(timeZone, date)) {
    return null;
  }

  const epoch = isDate
    ? startOfDayEpochNanoseconds(timeZone, plain)
    : epochNanosecondsFor(timeZone, plain, disambiguation ?? "compatible");
  return new Temporal.ZonedDateTime(epoch, timeZone, plain.calendarId);
}

/**
 * `PlainDate#toZonedDateTime(timeZone)` (start of day) or
 * `PlainDateTime#toZonedDateTime(timeZone, { disambiguation })`, correct at the range limits.
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
  try {
    return plain instanceof Temporal.PlainDate
      ? plain.toZonedDateTime(timeZone)
      : plain.toZonedDateTime(timeZone, { disambiguation });
  } catch (error) {
    return recoverAtRangeEdge(error, () =>
      plainToZonedAtEdge(plain, timeZone, disambiguation),
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Start of day, withPlainTime, hoursInDay
// ---------------------------------------------------------------------------------------------

function startOfDayAtEdge(
  zoned: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime | null {
  const date = zoned.toPlainDate();
  if (!isAtRangeEdge(zoned.timeZoneId, date)) {
    return null;
  }
  return inZoneOf(startOfDayEpochNanoseconds(zoned.timeZoneId, date), zoned);
}

/**
 * `ZonedDateTime#startOfDay`, correct at the range limits.
 *
 * @param zoned the value whose local day to start
 * @returns the first valid wall-clock time of that day; throws where TC39 Temporal throws
 */
export function zonedStartOfDay(
  zoned: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime {
  try {
    return zoned.startOfDay();
  } catch (error) {
    return recoverAtRangeEdge(error, () => startOfDayAtEdge(zoned));
  }
}

function withPlainTimeAtEdge(
  zoned: Temporal.ZonedDateTime,
  time: Temporal.PlainTime | Temporal.PlainTimeLike | string | undefined,
): Temporal.ZonedDateTime | null {
  if (time === undefined) {
    return startOfDayAtEdge(zoned);
  }

  const date = zoned.toPlainDate();
  let wall: Temporal.PlainDateTime;
  try {
    wall = date.toPlainDateTime(Temporal.PlainTime.from(time));
  } catch {
    return null;
  }

  if (!isAtRangeEdge(zoned.timeZoneId, date)) {
    return null;
  }
  return inZoneOf(
    epochNanosecondsFor(zoned.timeZoneId, wall, "compatible"),
    zoned,
  );
}

/**
 * `ZonedDateTime#withPlainTime`, correct at the range limits.
 *
 * @param zoned the value whose local date to keep
 * @param time the new wall-clock time; omitted means the start of the day
 * @returns the resolved Temporal.ZonedDateTime; throws where TC39 Temporal throws
 */
export function zonedWithPlainTime(
  zoned: Temporal.ZonedDateTime,
  time?: Temporal.PlainTime | Temporal.PlainTimeLike | string,
): Temporal.ZonedDateTime {
  try {
    return zoned.withPlainTime(time);
  } catch (error) {
    return recoverAtRangeEdge(error, () => withPlainTimeAtEdge(zoned, time));
  }
}

function hoursInDayAtEdge(zoned: Temporal.ZonedDateTime): number | null {
  const date = zoned.toPlainDate();
  if (!isAtRangeEdge(zoned.timeZoneId, date)) {
    return null;
  }

  const start = startOfDayEpochNanoseconds(zoned.timeZoneId, date);
  // Past the last representable date `add` throws, as TC39 `GetStartOfDay` does for that day.
  const end = startOfDayEpochNanoseconds(
    zoned.timeZoneId,
    date.add({ days: 1 }),
  );
  return Number(end - start) / NANOSECONDS_PER_HOUR;
}

/**
 * `ZonedDateTime#hoursInDay`, correct at the range limits.
 *
 * @param zoned the value whose local day to measure
 * @returns hours from this day's start to the next day's start; throws where TC39 Temporal throws
 */
export function zonedHoursInDay(zoned: Temporal.ZonedDateTime): number {
  try {
    return zoned.hoursInDay;
  } catch (error) {
    return recoverAtRangeEdge(error, () => hoursInDayAtEdge(zoned));
  }
}

// ---------------------------------------------------------------------------------------------
// Next transition
// ---------------------------------------------------------------------------------------------

/** The earliest transition after `zoned`, found by walking back from the maximum instant. */
function earliestTransitionBeforeMaximum(
  zoned: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime | null {
  if (zoned.epochNanoseconds >= MAX_EPOCH_NANOSECONDS) {
    return null;
  }

  const maximum = inZoneOf(MAX_EPOCH_NANOSECONDS, zoned);
  const justBeforeMaximum = inZoneOf(MAX_EPOCH_NANOSECONDS - 1n, zoned);
  // `previous` is strict, so a transition exactly at the maximum is checked directly.
  let earliest =
    justBeforeMaximum.offsetNanoseconds === maximum.offsetNanoseconds
      ? null
      : maximum;

  let cursor = maximum.getTimeZoneTransition("previous");
  for (
    let step = 0;
    cursor !== null && cursor.epochNanoseconds > zoned.epochNanoseconds;
    step++
  ) {
    if (step >= MAX_TRANSITIONS_BEFORE_MAXIMUM) {
      throw new RangeError(
        `Too many transitions in ${zoned.timeZoneId} before the maximum instant`,
      );
    }
    earliest = cursor;
    cursor = cursor.getTimeZoneTransition("previous");
  }

  return earliest;
}

/**
 * `ZonedDateTime#getTimeZoneTransition("next")`, correct at the range limits.
 *
 * The polyfill's forward scan gives up once a two-week step would pass the maximum instant, so a
 * `null` within its three-year horizon of the maximum is re-checked by walking back from the
 * maximum with `getTimeZoneTransition("previous")`, which scans correctly there.
 *
 * @param zoned the instant to search after (exclusive)
 * @returns the next transition, or null when there is none before the maximum instant
 */
export function zonedNextTransition(
  zoned: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime | null {
  const next = zoned.getTimeZoneTransition("next");

  if (
    next !== null ||
    !isNamedTimeZone(zoned.timeZoneId) ||
    MAX_EPOCH_NANOSECONDS - zoned.epochNanoseconds >
      NEXT_TRANSITION_HORIZON_NANOSECONDS
  ) {
    return next;
  }

  return earliestTransitionBeforeMaximum(zoned);
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

/** TC39 `AddZonedDateTime` for a duration with calendar units, at the range limits. */
function addAtEdge(
  zoned: Temporal.ZonedDateTime,
  durationLike: Temporal.Duration | Temporal.DurationLike | string,
  overflow: Overflow,
  sign: 1 | -1,
): Temporal.ZonedDateTime | null {
  let duration: Temporal.Duration;
  let wall: Temporal.PlainDateTime;
  try {
    const parsed = Temporal.Duration.from(durationLike);
    duration = sign === 1 ? parsed : parsed.negated();
    const start = zoned.toPlainDateTime();
    const { years, months, weeks, days } = duration;
    wall = calendarDateAdd(
      start.toPlainDate(),
      { years, months, weeks, days },
      overflow ?? "constrain",
    ).toPlainDateTime(start.toPlainTime());
  } catch {
    return null;
  }

  // Without calendar units the sum is exact-time arithmetic, which the polyfill gets right.
  if (
    !hasDateUnits(duration) ||
    !isAtRangeEdge(zoned.timeZoneId, wall.toPlainDate())
  ) {
    return null;
  }

  const result =
    epochNanosecondsFor(zoned.timeZoneId, wall, "compatible") +
    timeUnitsNanoseconds(duration);
  if (!isValidEpoch(result)) {
    throw new RangeError(
      `${zoned.toString()} + ${duration.toString()} is outside the supported range`,
    );
  }
  return inZoneOf(result, zoned);
}

/**
 * TC39 `AddZonedDateTime` with the calendar part through the Temporal compat layer (CORE-6 S5), or
 * null when `zoned`'s calendar needs no compat or the duration has no calendar units.
 *
 * `CalendarDateAdd` runs in `calendarDateAdd`; the wall clock it lands on resolves with
 * `~compatible~` through GMT's own `plainToZoned`; the time units are then exact time.
 */
function addWithCalendarCompat(
  zoned: Temporal.ZonedDateTime,
  durationLike: Temporal.Duration | Temporal.DurationLike | string,
  overflow: Overflow,
  sign: 1 | -1,
): Temporal.ZonedDateTime | null {
  if (!isCalendarArithmeticCompatNeeded(zoned.calendarId)) {
    return null;
  }
  const parsed = Temporal.Duration.from(durationLike);
  const duration = sign === 1 ? parsed : parsed.negated();
  if (!hasDateUnits(duration)) {
    return null;
  }
  // Validates `overflow` exactly as ZonedDateTime#add does.
  OVERFLOW_PROBE.add({ days: 0 }, { overflow });

  const wall = zoned.toPlainDateTime();
  const { years, months, weeks, days } = duration;
  const date = calendarDateAdd(
    wall.toPlainDate(),
    { years, months, weeks, days },
    overflow ?? "constrain",
  );
  const intermediate = plainToZoned(
    date.toPlainDateTime(wall.toPlainTime()),
    zoned.timeZoneId,
    "compatible",
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
 * `ZonedDateTime#add`, correct at the range limits and in calendars the polyfill gets wrong.
 *
 * @param zoned the starting value
 * @param duration the duration to add
 * @param options Temporal `overflow` for the calendar part
 * @returns the sum; throws where TC39 Temporal throws
 */
export function addToZoned(
  zoned: Temporal.ZonedDateTime,
  duration: Temporal.Duration | Temporal.DurationLike | string,
  options?: { overflow?: Overflow },
): Temporal.ZonedDateTime {
  const viaCompat = addWithCalendarCompat(
    zoned,
    duration,
    options?.overflow,
    1,
  );
  if (viaCompat !== null) {
    return viaCompat;
  }
  try {
    return zoned.add(duration, options);
  } catch (error) {
    return recoverAtRangeEdge(error, () =>
      addAtEdge(zoned, duration, options?.overflow, 1),
    );
  }
}

/**
 * `ZonedDateTime#subtract`, correct at the range limits.
 *
 * @param zoned the starting value
 * @param duration the duration to subtract
 * @param options Temporal `overflow` for the calendar part
 * @returns the difference; throws where TC39 Temporal throws
 */
export function subtractFromZoned(
  zoned: Temporal.ZonedDateTime,
  duration: Temporal.Duration | Temporal.DurationLike | string,
  options?: { overflow?: Overflow },
): Temporal.ZonedDateTime {
  const viaCompat = addWithCalendarCompat(
    zoned,
    duration,
    options?.overflow,
    -1,
  );
  if (viaCompat !== null) {
    return viaCompat;
  }
  try {
    return zoned.subtract(duration, options);
  } catch (error) {
    return recoverAtRangeEdge(error, () =>
      addAtEdge(zoned, duration, options?.overflow, -1),
    );
  }
}

// ---------------------------------------------------------------------------------------------
// with
// ---------------------------------------------------------------------------------------------

interface ZonedWithOptions {
  overflow?: Overflow;
  disambiguation?: Disambiguation;
  offset?: Offset;
}

/** TC39 `ZonedDateTime#with` at the range limits. */
function withAtEdge(
  zoned: Temporal.ZonedDateTime,
  fields: Temporal.ZonedDateTimeLike,
  options: ZonedWithOptions | undefined,
): Temporal.ZonedDateTime | null {
  let wall: Temporal.PlainDateTime;
  let offset: CarriedOffset;
  try {
    Temporal.ZonedDateTime.from(zoned, options);
    const { offset: offsetString, ...dateTimeFields } = fields;
    wall = zoned
      .toPlainDateTime()
      .with(dateTimeFields, { overflow: options?.overflow });
    offset = {
      nanoseconds:
        offsetString === undefined
          ? BigInt(zoned.offsetNanoseconds)
          : utcOffsetStringNanoseconds(offsetString),
    };
  } catch {
    return null;
  }

  if (!isAtRangeEdge(zoned.timeZoneId, wall.toPlainDate())) {
    return null;
  }

  const epoch = interpretISODateTimeOffset(
    zoned.timeZoneId,
    wall,
    offset,
    options?.disambiguation ?? "compatible",
    options?.offset ?? "prefer",
    false,
  );
  return inZoneOf(epoch, zoned);
}

/**
 * `ZonedDateTime#with`, correct at the range limits.
 *
 * @param zoned the value to change
 * @param fields the date/time (and optional offset) fields to set
 * @param options Temporal `overflow` / `disambiguation` / `offset` (default `"prefer"`)
 * @returns the changed value; throws where TC39 Temporal throws
 */
export function withZonedFields(
  zoned: Temporal.ZonedDateTime,
  fields: Temporal.ZonedDateTimeLike,
  options?: ZonedWithOptions,
): Temporal.ZonedDateTime {
  try {
    return zoned.with(fields, options);
  } catch (error) {
    return recoverAtRangeEdge(error, () => withAtEdge(zoned, fields, options));
  }
}

// ---------------------------------------------------------------------------------------------
// round
// ---------------------------------------------------------------------------------------------

/** Rounding modes that never move a non-negative progress past the start of the day. */
const ROUNDS_TOWARD_START: ReadonlySet<Temporal.RoundingMode> = new Set([
  "floor",
  "trunc",
]);
/** Rounding modes that move any positive progress to the start of the next day. */
const ROUNDS_TOWARD_END: ReadonlySet<Temporal.RoundingMode> = new Set([
  "ceil",
  "expand",
]);
/**
 * Half modes that resolve an exact half upward. Half-floor, half-trunc and half-even (0 is the
 * even quotient) resolve it to the start.
 */
const HALF_ROUNDS_TOWARD_END: ReadonlySet<Temporal.RoundingMode> = new Set([
  "halfCeil",
  "halfExpand",
]);

/** TC39 `RoundTimeDurationToIncrement` for `0 <= progress < length`: either 0 or `length`. */
function roundDayProgress(
  progress: bigint,
  length: bigint,
  roundingMode: Temporal.RoundingMode,
): bigint {
  if (progress === 0n || ROUNDS_TOWARD_START.has(roundingMode)) return 0n;
  if (ROUNDS_TOWARD_END.has(roundingMode)) return length;

  const twice = progress * 2n;
  if (twice === length) {
    return HALF_ROUNDS_TOWARD_END.has(roundingMode) ? length : 0n;
  }
  return twice < length ? 0n : length;
}

/** TC39 `ZonedDateTime#round` with `smallestUnit: "day"`: to the start of this day or the next. */
function roundToDayAtEdge(
  zoned: Temporal.ZonedDateTime,
  date: Temporal.PlainDate,
  roundingMode: Temporal.RoundingMode,
): Temporal.ZonedDateTime {
  const start = startOfDayEpochNanoseconds(zoned.timeZoneId, date);
  // Past the last representable date `add` throws, as TC39 `GetStartOfDay` does for that day.
  const end = startOfDayEpochNanoseconds(
    zoned.timeZoneId,
    date.add({ days: 1 }),
  );
  const progress = zoned.epochNanoseconds - start;

  return inZoneOf(
    start + roundDayProgress(progress, end - start, roundingMode),
    zoned,
  );
}

function roundAtEdge(
  zoned: Temporal.ZonedDateTime,
  roundTo: ZonedRoundTo,
): Temporal.ZonedDateTime | null {
  const date = zoned.toPlainDate();
  let roundedWall: Temporal.PlainDateTime;
  try {
    // Validates the options exactly as ZonedDateTime#round does, and rounds the wall clock.
    roundedWall = zoned.toPlainDateTime().round(roundTo);
  } catch {
    return null;
  }

  if (!isAtRangeEdge(zoned.timeZoneId, date)) {
    return null;
  }

  if (roundTo.smallestUnit === "day" || roundTo.smallestUnit === "days") {
    return roundToDayAtEdge(zoned, date, roundTo.roundingMode ?? "halfExpand");
  }

  const epoch = interpretISODateTimeOffset(
    zoned.timeZoneId,
    roundedWall,
    { nanoseconds: BigInt(zoned.offsetNanoseconds) },
    "compatible",
    "prefer",
    false,
  );
  return inZoneOf(epoch, zoned);
}

/**
 * `ZonedDateTime#round`, correct at the range limits.
 *
 * @param zoned the value to round
 * @param roundTo Temporal `smallestUnit` (day or smaller) / `roundingIncrement` / `roundingMode`
 * @returns the rounded value; throws where TC39 Temporal throws
 */
export function roundZonedDateTime(
  zoned: Temporal.ZonedDateTime,
  roundTo: ZonedRoundTo,
): Temporal.ZonedDateTime {
  try {
    return zoned.round(roundTo);
  } catch (error) {
    return recoverAtRangeEdge(error, () => roundAtEdge(zoned, roundTo));
  }
}
