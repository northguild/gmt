import type {
  DateTimeUnit,
  DifferenceOptions,
  DurationRoundTo,
  LargestUnit,
  RoundingMode,
  SmallestUnit,
} from "../temporalTypes";
import { Temporal } from "../temporal";
import type { DurationRelativeTo } from "../../types";
import { TIME_ZONE_ANNOTATION } from "../isoStringBody";
import {
  MAX_EPOCH_NANOSECONDS,
  MIN_EPOCH_NANOSECONDS,
} from "../epochNanoseconds";
import {
  calendarDateAdd as compatCalendarDateAdd,
  calendarDateUntil as compatCalendarDateUntil,
} from "../temporalCompat";
import {
  epochNanosecondsFor,
  isValidEpoch,
  utcEpochNanoseconds,
} from "../zonedWallClock";

/*
 * ---------------------------------------------------------------------------------------------
 * The TC39 abstract operations the zoned-difference workarounds share
 * ---------------------------------------------------------------------------------------------
 * Mirrors of `DifferenceZonedDateTime`, `NudgeToCalendarUnit`, `NudgeToZonedTime`,
 * `ComputeNudgeWindow`, `RoundRelativeDuration`, `BubbleRelativeDuration`,
 * `DifferencePlainDateTimeWith{Rounding,Total}`, `DateDurationDays` and
 * `CombineDateAndTimeDuration`, each under its TC39 name, so a workaround in this folder can
 * compute the spec's answer where `temporal-polyfill` does not (D22, `./nudgeOrigin.ts`). It goes
 * with that group.
 *
 * The throws in `differenceZonedDateTime`, `combineDateAndTimeDuration`, `nudgeToCalendarUnit`
 * and `nudgeToZonedTime` are this port's own Asserts. Their decision is in the header of
 * `./nudgeOrigin.ts` (D22).
 * ---------------------------------------------------------------------------------------------
 */

export type DateUnit = "year" | "month" | "week" | "day";
export type TimeUnit =
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "microsecond"
  | "nanosecond";
export type Unit = DateUnit | TimeUnit;

const UNITS: readonly Unit[] = [
  "year",
  "month",
  "week",
  "day",
  "hour",
  "minute",
  "second",
  "millisecond",
  "microsecond",
  "nanosecond",
];

const NANOSECONDS_PER_HOUR = 3_600_000_000_000n;
export const NANOSECONDS_PER_DAY = 24n * NANOSECONDS_PER_HOUR;

/** TC39 Table "Temporal units by descending magnitude", "Length in Nanoseconds" column. */
export const NANOSECONDS_PER_TIME_UNIT: Record<TimeUnit, bigint> = {
  hour: NANOSECONDS_PER_HOUR,
  minute: 60_000_000_000n,
  second: 1_000_000_000n,
  millisecond: 1_000_000n,
  microsecond: 1_000n,
  nanosecond: 1n,
};

/** TC39 `maxTimeDuration`: 2^53 × 10^9 − 1 nanoseconds. */
const MAX_TIME_DURATION = 2n ** 53n * 1_000_000_000n - 1n;

/** Validates Temporal options exactly as the wrapped method does, far from any limit. */
const OPTIONS_PROBE = new Temporal.ZonedDateTime(0n, "UTC");
const ZERO_DURATION = new Temporal.Duration();

/** An RFC 9557 time zone annotation (`[Europe/London]`, `[!+01:00]`), never a `key=value` one. */
export const timeZoneAnnotation = new RegExp(TIME_ZONE_ANNOTATION);

interface DateDuration {
  years: number;
  months: number;
  weeks: number;
  days: number;
}

/** TC39 Internal Duration Record. */
export interface InternalDuration {
  date: DateDuration;
  time: bigint;
}

/** TC39 Duration Nudge Result Record. */
interface NudgeResult {
  duration: InternalDuration;
  nudgedEpochNs: bigint;
  didExpandCalendarUnit: boolean;
}

interface NudgeWindow {
  r1: number;
  r2: number;
  startEpochNs: bigint;
  endEpochNs: bigint;
  startDuration: DateDuration;
  endDuration: DateDuration;
}

/**
 * The time zone, calendar and origin wall clock (`isoDateTime`) the rounding steps share. An unset
 * `timeZone` is the spec's plain context: exact times are `GetUTCEpochNanoseconds`, never checked
 * against the instant range.
 */
interface RoundingContext {
  timeZone: string | undefined;
  calendar: string;
  wall: Temporal.PlainDateTime;
}

/** A rounding context with a time zone. */
interface ZonedContext extends RoundingContext {
  timeZone: string;
}

export interface RoundingSettings {
  largestUnit: Unit;
  smallestUnit: Unit;
  increment: number;
  roundingMode: RoundingMode;
}

type Sign = -1 | 1;
type UnsignedRoundingMode =
  | "zero"
  | "infinity"
  | "half-zero"
  | "half-infinity"
  | "half-even";

/** Options accepted by `ZonedDateTime#until`. */
export type ZonedDifferenceOptions = DifferenceOptions<DateTimeUnit>;

/** Options accepted by `Duration#round`, with GMT's `relativeTo` forms. */
export interface DurationRoundOptions {
  largestUnit?: LargestUnit<DateTimeUnit>;
  smallestUnit?: SmallestUnit<DateTimeUnit>;
  roundingIncrement?: number;
  roundingMode?: RoundingMode;
  relativeTo?: DurationRelativeTo;
}

const ZERO_DATE_DURATION: DateDuration = {
  years: 0,
  months: 0,
  weeks: 0,
  days: 0,
};

// ---------------------------------------------------------------------------------------------
// Units, signs and rounding
// ---------------------------------------------------------------------------------------------

/** A Temporal unit name, singular or plural, or null when it is not one. */
export function toUnit(value: unknown): Unit | null {
  if (typeof value !== "string") return null;
  const singular = value.endsWith("s") ? value.slice(0, -1) : value;
  return UNITS.find((unit) => unit === singular) ?? null;
}

/** TC39 `TemporalUnitCategory(unit)` is ~date~. */
export function isDateUnit(unit: Unit): unit is DateUnit {
  return UNITS.indexOf(unit) <= UNITS.indexOf("day");
}

/** TC39 `LargerOfTwoTemporalUnits`. */
export function largerUnit(one: Unit, two: Unit): Unit {
  return UNITS.indexOf(one) <= UNITS.indexOf(two) ? one : two;
}

export function bigintSign(value: bigint): -1 | 0 | 1 {
  if (value < 0n) return -1;
  return value > 0n ? 1 : 0;
}

export function bigintAbs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/** TC39 `DateDurationSign`. */
function dateDurationSign(duration: DateDuration): -1 | 0 | 1 {
  for (const value of [
    duration.years,
    duration.months,
    duration.weeks,
    duration.days,
  ]) {
    if (value !== 0) return value < 0 ? -1 : 1;
  }
  return 0;
}

/** TC39 `InternalDurationSign`. */
function internalDurationSign(duration: InternalDuration): -1 | 0 | 1 {
  return dateDurationSign(duration.date) || bigintSign(duration.time);
}

/** TC39 `AdjustDateDurationRecord`. */
function adjustDateDuration(
  duration: DateDuration,
  days: number,
  weeks = duration.weeks,
  months = duration.months,
): DateDuration {
  return { years: duration.years, months, weeks, days };
}

/** TC39 `ToInternalDurationRecord`. */
export function toInternalDuration(
  duration: Temporal.Duration,
): InternalDuration {
  const { years, months, weeks, days } = duration;
  return {
    date: { years, months, weeks, days },
    time:
      BigInt(duration.hours) * NANOSECONDS_PER_TIME_UNIT.hour +
      BigInt(duration.minutes) * NANOSECONDS_PER_TIME_UNIT.minute +
      BigInt(duration.seconds) * NANOSECONDS_PER_TIME_UNIT.second +
      BigInt(duration.milliseconds) * NANOSECONDS_PER_TIME_UNIT.millisecond +
      BigInt(duration.microseconds) * NANOSECONDS_PER_TIME_UNIT.microsecond +
      BigInt(duration.nanoseconds),
  };
}

/** TC39 `DefaultTemporalLargestUnit`. */
export function defaultLargestUnit(duration: Temporal.Duration): Unit {
  return (
    UNITS.find((unit) => duration[`${unit}s` as const] !== 0) ?? "nanosecond"
  );
}

/** TC39 `GetUnsignedRoundingMode`, as [positive, negative]. */
const UNSIGNED_ROUNDING_MODES: Record<
  RoundingMode,
  readonly [UnsignedRoundingMode, UnsignedRoundingMode]
> = {
  ceil: ["infinity", "zero"],
  floor: ["zero", "infinity"],
  expand: ["infinity", "infinity"],
  trunc: ["zero", "zero"],
  halfCeil: ["half-infinity", "half-zero"],
  halfFloor: ["half-zero", "half-infinity"],
  halfExpand: ["half-infinity", "half-infinity"],
  halfTrunc: ["half-zero", "half-zero"],
  halfEven: ["half-even", "half-even"],
};

function unsignedRoundingMode(
  roundingMode: RoundingMode,
  sign: -1 | 0 | 1,
): UnsignedRoundingMode {
  return UNSIGNED_ROUNDING_MODES[roundingMode][sign < 0 ? 1 : 0];
}

/** TC39 `ApplyUnsignedRoundingMode`, given the sign of (2 × remainder − increment) as `cmp`. */
function applyUnsignedRoundingMode<T>(
  r1: T,
  r2: T,
  cmp: number,
  even: boolean,
  mode: UnsignedRoundingMode,
): T {
  if (mode === "zero") return r1;
  if (mode === "infinity") return r2;
  if (cmp !== 0) return cmp < 0 ? r1 : r2;
  if (mode === "half-zero") return r1;
  if (mode === "half-infinity") return r2;
  return even ? r1 : r2;
}

/** TC39 `RoundTimeDurationToIncrement`. */
function roundTimeDurationToIncrement(
  duration: bigint,
  increment: bigint,
  roundingMode: RoundingMode,
): bigint {
  const quotient = bigintAbs(duration / increment);
  const remainder = duration % increment;
  const r1 = quotient * increment;
  const rounded =
    remainder === 0n
      ? r1
      : applyUnsignedRoundingMode(
          r1,
          r1 + increment,
          bigintSign(bigintAbs(remainder * 2n) - increment),
          quotient % 2n === 0n,
          unsignedRoundingMode(roundingMode, bigintSign(duration)),
        );
  const result = duration < 0n ? -rounded : rounded;

  if (bigintAbs(result) > MAX_TIME_DURATION) {
    throw new RangeError("The rounded time duration is out of range");
  }
  return result;
}

/**
 * The float64 value of `numerator / denominator`, as the polyfill's `TimeDuration#fdiv` computes
 * TC39's exact division: the integer quotient plus 50 long-division decimal digits.
 */
function divideToNumber(numerator: bigint, denominator: bigint): number {
  const divisor = bigintAbs(denominator);
  let remainder = bigintAbs(numerator % denominator);
  const digits: string[] = [];
  while (remainder !== 0n && digits.length < 50) {
    remainder *= 10n;
    digits.push(String(remainder / divisor));
    remainder %= divisor;
  }

  const magnitude = Number(
    `${bigintAbs(numerator / denominator)}.${digits.join("")}`,
  );
  return bigintSign(numerator) * bigintSign(denominator) < 0
    ? -magnitude
    : magnitude;
}

// ---------------------------------------------------------------------------------------------
// Date-time steps, from polyfill operations that are correct at the limits
// ---------------------------------------------------------------------------------------------

/** TC39 `GetISODateTimeFor`. */
export function isoDateTimeFor(
  timeZone: string,
  epochNs: bigint,
): Temporal.PlainDateTime {
  return new Temporal.ZonedDateTime(epochNs, timeZone).toPlainDateTime();
}

/** TC39 `GetEpochNanosecondsFor(timeZone, isoDateTime, ~compatible~)` for a named zone. */
function epochFor(timeZone: string, wall: Temporal.PlainDateTime): bigint {
  return epochNanosecondsFor(timeZone, wall, "compatible");
}

/**
 * TC39 `CombineISODateAndTimeRecord`. A combination outside the PlainDateTime limits throws here;
 * the spec throws for it at the `GetEpochNanosecondsFor` that always follows.
 */
export function atTimeOf(
  date: Temporal.PlainDate,
  wall: Temporal.PlainDateTime,
): Temporal.PlainDateTime {
  return date.toPlainDateTime(wall.toPlainTime());
}

/**
 * TC39 `CalendarDateAdd(calendar, isoDate, duration, ~constrain~)`, through the Temporal compat
 * layer (the polyfill's own `add` for `iso8601`).
 */
function calendarDateAdd(
  calendar: string,
  isoDate: Temporal.PlainDate,
  duration: DateDuration,
): Temporal.PlainDate {
  return compatCalendarDateAdd(
    isoDate.withCalendar(calendar),
    duration,
    "constrain",
  ).withCalendar("iso8601");
}

/** TC39 `CalendarDateUntil`, through the Temporal compat layer. */
export function calendarDateUntil(
  calendar: string,
  one: Temporal.PlainDate,
  two: Temporal.PlainDate,
  largestUnit: DateUnit,
): DateDuration {
  return compatCalendarDateUntil(
    one.withCalendar(calendar),
    two.withCalendar(calendar),
    largestUnit,
  );
}

/** TC39 `AddInstant`. */
function addInstant(epochNs: bigint, time: bigint): bigint {
  const result = epochNs + time;
  if (!isValidEpoch(result)) {
    throw new RangeError("The result is outside the supported range");
  }
  return result;
}

/** TC39 `AddZonedDateTime(…, ~constrain~)`. */
function addZonedDateTime(
  zoned: Temporal.ZonedDateTime,
  duration: InternalDuration,
): bigint {
  if (dateDurationSign(duration.date) === 0) {
    return addInstant(zoned.epochNanoseconds, duration.time);
  }

  const wall = isoDateTimeFor(zoned.timeZoneId, zoned.epochNanoseconds);
  const addedDate = calendarDateAdd(
    zoned.calendarId,
    wall.toPlainDate(),
    duration.date,
  );
  return addInstant(
    epochFor(zoned.timeZoneId, atTimeOf(addedDate, wall)),
    duration.time,
  );
}

/** TC39 `TemporalDurationFromInternal` for a time `largestUnit`, balanced by `Instant#until`. */
export function temporalDurationFromInternal(
  duration: InternalDuration,
  largestUnit: TimeUnit,
): Temporal.Duration {
  const base =
    duration.time < 0n ? MAX_EPOCH_NANOSECONDS : MIN_EPOCH_NANOSECONDS;
  const time = new Temporal.Instant(base).until(
    new Temporal.Instant(base + duration.time),
    { largestUnit },
  );
  const { years, months, weeks, days } = duration.date;

  return new Temporal.Duration(
    years,
    months,
    weeks,
    days,
    time.hours,
    time.minutes,
    time.seconds,
    time.milliseconds,
    time.microseconds,
    time.nanoseconds,
  );
}

// ---------------------------------------------------------------------------------------------
// Difference and rounding abstract operations
// ---------------------------------------------------------------------------------------------

/** TC39 `DifferenceZonedDateTime`. */
function differenceZonedDateTime(
  ns1: bigint,
  ns2: bigint,
  context: Omit<ZonedContext, "wall">,
  largestUnit: Unit,
): InternalDuration {
  if (ns1 === ns2) return { date: ZERO_DATE_DURATION, time: 0n };

  const start = isoDateTimeFor(context.timeZone, ns1);
  const end = isoDateTimeFor(context.timeZone, ns2);
  const startDate = start.toPlainDate();
  const endDate = end.toPlainDate();
  if (Temporal.PlainDate.compare(startDate, endDate) === 0) {
    return { date: ZERO_DATE_DURATION, time: ns2 - ns1 };
  }

  const sign = ns2 - ns1 < 0n ? 1 : -1;
  const maxDayCorrection = sign === -1 ? 2 : 1;
  // TimeDurationSign(DifferenceTime(start time, end time)) = sign
  let dayCorrection =
    Temporal.PlainTime.compare(end.toPlainTime(), start.toPlainTime()) === sign
      ? 1
      : 0;

  for (; dayCorrection <= maxDayCorrection; dayCorrection++) {
    const intermediate = atTimeOf(
      endDate.add({ days: dayCorrection * sign }),
      start,
    );
    const time = ns2 - epochFor(context.timeZone, intermediate);
    if (bigintSign(time) !== sign) {
      return combineDateAndTimeDuration(
        calendarDateUntil(
          context.calendar,
          startDate,
          intermediate.toPlainDate(),
          largerUnit(largestUnit, "day") as DateUnit,
        ),
        time,
      );
    }
  }

  // TC39 Asserts here too: tc39/proposal-temporal#3311, the same decision as below.
  throw new RangeError("More than the maximum day correction was needed");
}

/**
 * TC39 `CombineDateAndTimeDuration`. Its Assert fails when the two signs disagree, which a repeated
 * hour spanning midnight causes: 15 minutes after `1944-10-01T00:00:59-06:00` in America/Phoenix
 * reads `1944-09-30T23:15:59-07:00`. The specification has no value there, so this throws and the
 * public function returns its sentinel (tc39/proposal-temporal#3311).
 */
function combineDateAndTimeDuration(
  date: DateDuration,
  time: bigint,
): InternalDuration {
  if (dateDurationSign(date) * bigintSign(time) < 0) {
    throw new RangeError("The date and time signs disagree");
  }
  return { date, time };
}

function truncateToIncrement(value: number, increment: number): number {
  return Math.trunc(value / increment) * increment;
}

/** The [[R1]]/[[R2]] bounds and their date durations, from TC39 `ComputeNudgeWindow` steps 1–4. */
function nudgeWindowBounds(
  sign: Sign,
  date: DateDuration,
  context: RoundingContext,
  increment: number,
  unit: DateUnit,
  additionalShift: boolean,
): Pick<NudgeWindow, "r1" | "r2" | "startDuration" | "endDuration"> {
  const shift = additionalShift ? increment * sign : 0;

  if (unit === "year") {
    const r1 = truncateToIncrement(date.years, increment) + shift;
    const r2 = r1 + increment * sign;
    return {
      r1,
      r2,
      startDuration: { ...ZERO_DATE_DURATION, years: r1 },
      endDuration: { ...ZERO_DATE_DURATION, years: r2 },
    };
  }
  if (unit === "month") {
    const r1 = truncateToIncrement(date.months, increment) + shift;
    const r2 = r1 + increment * sign;
    return {
      r1,
      r2,
      startDuration: adjustDateDuration(date, 0, 0, r1),
      endDuration: adjustDateDuration(date, 0, 0, r2),
    };
  }
  if (unit === "week") {
    const weeksStart = calendarDateAdd(
      context.calendar,
      context.wall.toPlainDate(),
      adjustDateDuration(date, 0, 0),
    );
    const weeksEnd = weeksStart.add({ days: date.days });
    const untilResult = calendarDateUntil(
      context.calendar,
      weeksStart,
      weeksEnd,
      "week",
    );
    const r1 = truncateToIncrement(date.weeks + untilResult.weeks, increment);
    const r2 = r1 + increment * sign;
    return {
      r1,
      r2,
      startDuration: adjustDateDuration(date, 0, r1),
      endDuration: adjustDateDuration(date, 0, r2),
    };
  }

  const r1 = truncateToIncrement(date.days, increment);
  const r2 = r1 + increment * sign;
  return {
    r1,
    r2,
    startDuration: adjustDateDuration(date, r1),
    endDuration: adjustDateDuration(date, r2),
  };
}

/** The exact time `duration` after the origin wall clock, resolved in the zone. */
function windowBoundEpoch(
  context: RoundingContext,
  duration: DateDuration,
): bigint {
  const date = calendarDateAdd(
    context.calendar,
    context.wall.toPlainDate(),
    duration,
  );
  return contextEpoch(context, atTimeOf(date, context.wall));
}

/**
 * The exact time of `wall` in `context`: TC39 `GetEpochNanosecondsFor(timeZone, wall, ~compatible~)`,
 * or `GetUTCEpochNanoseconds(wall)` when the time zone is unset (a plain context).
 */
function contextEpoch(
  context: RoundingContext,
  wall: Temporal.PlainDateTime,
): bigint {
  return context.timeZone === undefined
    ? utcEpochNanoseconds(wall)
    : epochFor(context.timeZone, wall);
}

/** TC39 `ComputeNudgeWindow`. */
function computeNudgeWindow(
  sign: Sign,
  duration: InternalDuration,
  originEpochNs: bigint,
  context: RoundingContext,
  increment: number,
  unit: DateUnit,
  additionalShift: boolean,
): NudgeWindow {
  const bounds = nudgeWindowBounds(
    sign,
    duration.date,
    context,
    increment,
    unit,
    additionalShift,
  );
  // A start bound that adds nothing is the origin itself, never a re-resolved wall clock.
  const startEpochNs =
    dateDurationSign(bounds.startDuration) === 0
      ? originEpochNs
      : windowBoundEpoch(context, bounds.startDuration);

  return {
    ...bounds,
    startEpochNs,
    endEpochNs: windowBoundEpoch(context, bounds.endDuration),
  };
}

function windowContains(
  sign: Sign,
  window: NudgeWindow,
  destEpochNs: bigint,
): boolean {
  const [low, high] =
    sign === 1
      ? [window.startEpochNs, window.endEpochNs]
      : [window.endEpochNs, window.startEpochNs];
  return low <= destEpochNs && destEpochNs <= high;
}

/** TC39 `NudgeToCalendarUnit`; `total` is its [[Total]]. */
function nudgeToCalendarUnit(
  sign: Sign,
  duration: InternalDuration,
  originEpochNs: bigint,
  destEpochNs: bigint,
  context: RoundingContext,
  increment: number,
  unit: DateUnit,
  roundingMode: RoundingMode,
): { nudgeResult: NudgeResult; total: number } {
  let window = computeNudgeWindow(
    sign,
    duration,
    originEpochNs,
    context,
    increment,
    unit,
    false,
  );
  let didExpandCalendarUnit = false;
  if (!windowContains(sign, window, destEpochNs)) {
    window = computeNudgeWindow(
      sign,
      duration,
      originEpochNs,
      context,
      increment,
      unit,
      true,
    );
    // TC39 Asserts here. The shift only moves a month or a year, so a day or a week that missed the
    // first window misses this one, and the specification has no value: the public function returns
    // its sentinel rather than extrapolate (tc39/proposal-temporal#3336).
    if (!windowContains(sign, window, destEpochNs)) {
      throw new RangeError("The target is outside the window");
    }
    didExpandCalendarUnit = true;
  }

  const { r1, r2, startEpochNs, endEpochNs } = window;
  const progress = destEpochNs - startEpochNs;
  const span = endEpochNs - startEpochNs;
  const total = divideToNumber(
    span * BigInt(r1) + progress * BigInt(sign),
    span,
  );

  let roundedUnit: number;
  if (progress === 0n) {
    // The target is the lower bound itself, so it is already rounded. TC39 leaves this to
    // ApplyUnsignedRoundingMode's "if x is equal to r1, return r1" step, which this
    // comparison-based form cannot see: without the branch, `ceil` (unsigned mode "infinity")
    // would expand an exact boundary to the next whole unit.
    roundedUnit = Math.abs(r1);
  } else if (progress === span) {
    roundedUnit = Math.abs(r2);
  } else {
    roundedUnit = applyUnsignedRoundingMode(
      Math.abs(r1),
      Math.abs(r2),
      bigintSign(bigintAbs(progress * 2n) - bigintAbs(span)),
      (Math.abs(r1) / increment) % 2 === 0,
      unsignedRoundingMode(roundingMode, sign),
    );
  }

  const expanded = roundedUnit === Math.abs(r2);
  return {
    nudgeResult: {
      duration: {
        date: expanded ? window.endDuration : window.startDuration,
        time: 0n,
      },
      nudgedEpochNs: expanded ? endEpochNs : startEpochNs,
      didExpandCalendarUnit: didExpandCalendarUnit || expanded,
    },
    total,
  };
}

/** TC39 `NudgeToZonedTime`. */
function nudgeToZonedTime(
  sign: Sign,
  duration: InternalDuration,
  context: ZonedContext,
  increment: number,
  unit: TimeUnit,
  roundingMode: RoundingMode,
): NudgeResult {
  const start = calendarDateAdd(
    context.calendar,
    context.wall.toPlainDate(),
    duration.date,
  );
  const startEpochNs = epochFor(
    context.timeZone,
    atTimeOf(start, context.wall),
  );
  const endEpochNs = epochFor(
    context.timeZone,
    atTimeOf(start.add({ days: sign }), context.wall),
  );
  const daySpan = endEpochNs - startEpochNs;
  if (bigintSign(daySpan) !== sign) {
    // A skipped day ends the span where it starts, and TC39 Asserts here
    // (tc39/proposal-temporal#3310). The public function returns its sentinel.
    throw new RangeError("The time zone returned inconsistent instants");
  }

  const unitIncrement = BigInt(increment) * NANOSECONDS_PER_TIME_UNIT[unit];
  let roundedTime = roundTimeDurationToIncrement(
    duration.time,
    unitIncrement,
    roundingMode,
  );
  const beyondDaySpan = roundedTime - daySpan;
  const didRoundBeyondDay = bigintSign(beyondDaySpan) !== -sign;

  let nudgedEpochNs = startEpochNs + roundedTime;
  if (didRoundBeyondDay) {
    roundedTime = roundTimeDurationToIncrement(
      beyondDaySpan,
      unitIncrement,
      roundingMode,
    );
    nudgedEpochNs = endEpochNs + roundedTime;
  }

  return {
    duration: {
      date: adjustDateDuration(
        duration.date,
        duration.date.days + (didRoundBeyondDay ? sign : 0),
      ),
      time: roundedTime,
    },
    nudgedEpochNs,
    didExpandCalendarUnit: didRoundBeyondDay,
  };
}

/** The date duration one `unit` further than `date`, per TC39 `BubbleRelativeDuration` step 6.a. */
function oneUnitFurther(
  date: DateDuration,
  unit: Exclude<DateUnit, "day">,
  sign: Sign,
): DateDuration {
  if (unit === "year") {
    return { ...ZERO_DATE_DURATION, years: date.years + sign };
  }
  if (unit === "month") {
    return adjustDateDuration(date, 0, 0, date.months + sign);
  }
  return adjustDateDuration(date, 0, date.weeks + sign);
}

/** TC39 `BubbleRelativeDuration`. */
function bubbleRelativeDuration(
  sign: Sign,
  duration: InternalDuration,
  nudgedEpochNs: bigint,
  context: RoundingContext,
  largestUnit: Unit,
  smallestUnit: DateUnit,
): InternalDuration {
  let bubbled = duration;

  for (
    let index = UNITS.indexOf(smallestUnit) - 1;
    index >= UNITS.indexOf(largestUnit);
    index--
  ) {
    const unit = UNITS[index] as Exclude<DateUnit, "day">;
    if (unit === "week" && largestUnit !== "week") continue;

    const endDuration = oneUnitFurther(bubbled.date, unit, sign);
    const endEpochNs = windowBoundEpoch(context, endDuration);
    if (bigintSign(nudgedEpochNs - endEpochNs) === -sign) break;
    bubbled = { date: endDuration, time: 0n };
  }

  return bubbled;
}

/** TC39 `RoundRelativeDuration` with a time zone. */
export function roundRelativeDuration(
  duration: InternalDuration,
  originEpochNs: bigint,
  destEpochNs: bigint,
  context: RoundingContext,
  settings: RoundingSettings,
): InternalDuration {
  const { largestUnit, smallestUnit } = settings;
  const sign: Sign = internalDurationSign(duration) < 0 ? -1 : 1;

  const nudgeResult = nudgeRelativeDuration(
    sign,
    duration,
    originEpochNs,
    destEpochNs,
    context,
    settings,
  );

  if (!nudgeResult.didExpandCalendarUnit || smallestUnit === "week") {
    return nudgeResult.duration;
  }
  return bubbleRelativeDuration(
    sign,
    nudgeResult.duration,
    nudgeResult.nudgedEpochNs,
    context,
    largestUnit,
    largerUnit(smallestUnit, "day") as DateUnit,
  );
}

/** TC39 `DifferenceZonedDateTimeWithRounding`. */
function differenceZonedDateTimeWithRounding(
  ns1: bigint,
  ns2: bigint,
  context: Omit<ZonedContext, "wall">,
  settings: RoundingSettings,
): InternalDuration {
  const { largestUnit, smallestUnit, increment, roundingMode } = settings;

  if (!isDateUnit(largestUnit)) {
    // TC39 DifferenceInstant: the smallest unit is a time unit too.
    return {
      date: ZERO_DATE_DURATION,
      time: roundTimeDurationToIncrement(
        ns2 - ns1,
        BigInt(increment) * NANOSECONDS_PER_TIME_UNIT[smallestUnit as TimeUnit],
        roundingMode,
      ),
    };
  }

  const difference = differenceZonedDateTime(ns1, ns2, context, largestUnit);
  if (smallestUnit === "nanosecond" && increment === 1) return difference;

  return roundRelativeDuration(
    difference,
    ns1,
    ns2,
    { ...context, wall: isoDateTimeFor(context.timeZone, ns1) },
    settings,
  );
}

// ---------------------------------------------------------------------------------------------
// Plain context: no time zone, exact times are
// GetUTCEpochNanoseconds and are never checked against the instant range
// ---------------------------------------------------------------------------------------------

/** An ISO date far from the limits, used only to validate options. */
export const PLAIN_DATE_PROBE = new Temporal.PlainDate(2000, 1, 1);

/** TC39 `IsCalendarUnit`. */
export function isCalendarUnit(unit: Unit): unit is "year" | "month" | "week" {
  return unit === "year" || unit === "month" || unit === "week";
}

/** TC39 `RoundRelativeDuration` steps 1–5: the nudge for `settings.smallestUnit` in `context`. */
function nudgeRelativeDuration(
  sign: Sign,
  duration: InternalDuration,
  originEpochNs: bigint,
  destEpochNs: bigint,
  context: RoundingContext,
  settings: RoundingSettings,
): NudgeResult {
  const { largestUnit, smallestUnit, increment, roundingMode } = settings;
  const { timeZone } = context;

  // irregularLengthUnit: a calendar unit, or a day with a time zone.
  if (
    isCalendarUnit(smallestUnit) ||
    (timeZone !== undefined && smallestUnit === "day")
  ) {
    return nudgeToCalendarUnit(
      sign,
      duration,
      originEpochNs,
      destEpochNs,
      context,
      increment,
      smallestUnit as DateUnit,
      roundingMode,
    ).nudgeResult;
  }
  if (timeZone !== undefined) {
    return nudgeToZonedTime(
      sign,
      duration,
      { ...context, timeZone },
      increment,
      smallestUnit as TimeUnit,
      roundingMode,
    );
  }
  return nudgeToDayOrTime(
    duration,
    destEpochNs,
    largestUnit,
    increment,
    smallestUnit as "day" | TimeUnit,
    roundingMode,
  );
}

/** TC39 `NudgeToDayOrTime`. */
function nudgeToDayOrTime(
  duration: InternalDuration,
  destEpochNs: bigint,
  largestUnit: Unit,
  increment: number,
  smallestUnit: "day" | TimeUnit,
  roundingMode: RoundingMode,
): NudgeResult {
  const timeDuration =
    duration.time + BigInt(duration.date.days) * NANOSECONDS_PER_DAY;
  const unitLength =
    smallestUnit === "day"
      ? NANOSECONDS_PER_DAY
      : NANOSECONDS_PER_TIME_UNIT[smallestUnit];
  const roundedTime = roundTimeDurationToIncrement(
    timeDuration,
    unitLength * BigInt(increment),
    roundingMode,
  );
  // TotalTimeDuration(…, day) truncated: bigint division truncates toward zero.
  const wholeDays = timeDuration / NANOSECONDS_PER_DAY;
  const roundedWholeDays = roundedTime / NANOSECONDS_PER_DAY;
  const keepsDays = isDateUnit(largestUnit);

  return {
    duration: {
      date: adjustDateDuration(
        duration.date,
        keepsDays ? Number(roundedWholeDays) : 0,
      ),
      time: keepsDays
        ? roundedTime - roundedWholeDays * NANOSECONDS_PER_DAY
        : roundedTime,
    },
    nudgedEpochNs: destEpochNs + (roundedTime - timeDuration),
    didExpandCalendarUnit:
      bigintSign(roundedWholeDays - wholeDays) === bigintSign(timeDuration),
  };
}

/** Nanoseconds since midnight on `wall`'s own date. */
function timeOfDayNanoseconds(wall: Temporal.PlainDateTime): bigint {
  return (
    BigInt(wall.hour) * NANOSECONDS_PER_TIME_UNIT.hour +
    BigInt(wall.minute) * NANOSECONDS_PER_TIME_UNIT.minute +
    BigInt(wall.second) * NANOSECONDS_PER_TIME_UNIT.second +
    BigInt(wall.millisecond) * NANOSECONDS_PER_TIME_UNIT.millisecond +
    BigInt(wall.microsecond) * NANOSECONDS_PER_TIME_UNIT.microsecond +
    BigInt(wall.nanosecond)
  );
}

/** TC39 `DifferenceISODateTime`, for two ISO-calendar wall clocks. */
function differenceISODateTime(
  one: Temporal.PlainDateTime,
  two: Temporal.PlainDateTime,
  calendar: string,
  largestUnit: Unit,
): InternalDuration {
  let time = timeOfDayNanoseconds(two) - timeOfDayNanoseconds(one);
  const timeSign = bigintSign(time);
  const dateSign = Temporal.PlainDate.compare(
    one.toPlainDate(),
    two.toPlainDate(),
  );
  let adjustedDate = two.toPlainDate();
  if (timeSign === dateSign) {
    adjustedDate = adjustedDate.add({ days: timeSign });
    time -= BigInt(timeSign) * NANOSECONDS_PER_DAY;
  }

  const dateLargestUnit = largerUnit("day", largestUnit) as DateUnit;
  const date = calendarDateUntil(
    calendar,
    one.toPlainDate(),
    adjustedDate,
    dateLargestUnit,
  );
  if (largestUnit === dateLargestUnit) {
    return { date, time };
  }
  return {
    date: adjustDateDuration(date, 0),
    time: time + BigInt(date.days) * NANOSECONDS_PER_DAY,
  };
}

export function plainContext(
  calendar: string,
  wall: Temporal.PlainDateTime,
): RoundingContext {
  return { timeZone: undefined, calendar, wall };
}

/** TC39 `DifferencePlainDateTimeWithRounding`. */
export function differencePlainDateTimeWithRounding(
  one: Temporal.PlainDateTime,
  two: Temporal.PlainDateTime,
  calendar: string,
  settings: RoundingSettings,
): InternalDuration {
  if (Temporal.PlainDateTime.compare(one, two) === 0) {
    return { date: ZERO_DATE_DURATION, time: 0n };
  }
  const difference = differenceISODateTime(
    one,
    two,
    calendar,
    settings.largestUnit,
  );
  if (settings.smallestUnit === "nanosecond" && settings.increment === 1) {
    return difference;
  }
  return roundRelativeDuration(
    difference,
    utcEpochNanoseconds(one),
    utcEpochNanoseconds(two),
    plainContext(calendar, one),
    settings,
  );
}

/** TC39 `DifferencePlainDateTimeWithTotal`. */
function differencePlainDateTimeWithTotal(
  one: Temporal.PlainDateTime,
  two: Temporal.PlainDateTime,
  calendar: string,
  unit: Unit,
): number {
  if (Temporal.PlainDateTime.compare(one, two) === 0) return 0;

  const difference = differenceISODateTime(one, two, calendar, unit);
  if (isCalendarUnit(unit)) {
    // TC39 TotalRelativeDuration for a calendar unit.
    return nudgeToCalendarUnit(
      internalDurationSign(difference) < 0 ? -1 : 1,
      difference,
      utcEpochNanoseconds(one),
      utcEpochNanoseconds(two),
      plainContext(calendar, one),
      1,
      unit,
      "trunc",
    ).total;
  }
  return divideToNumber(
    difference.time + BigInt(difference.date.days) * NANOSECONDS_PER_DAY,
    unit === "day" ? NANOSECONDS_PER_DAY : NANOSECONDS_PER_TIME_UNIT[unit],
  );
}

/**
 * The origin and target wall clocks TC39 `Duration#round` / `Duration#total` build from a plain
 * `relativeTo`: `ToInternalDurationRecordWith24HourDays`, `AddTime` from midnight, and
 * `CalendarDateAdd` of the date part plus the whole days that carried out of the time.
 */
function plainRelativeTarget(
  duration: Temporal.Duration,
  plain: Temporal.PlainDate,
): { origin: Temporal.PlainDateTime; target: Temporal.PlainDateTime } {
  const internal = toInternalDuration(duration);
  const time = internal.time + BigInt(internal.date.days) * NANOSECONDS_PER_DAY;
  let carriedDays = time / NANOSECONDS_PER_DAY;
  let timeOfDay = time % NANOSECONDS_PER_DAY;
  if (timeOfDay < 0n) {
    carriedDays -= 1n;
    timeOfDay += NANOSECONDS_PER_DAY;
  }

  const origin = plain.withCalendar("iso8601").toPlainDateTime();
  const targetDate = calendarDateAdd(
    plain.calendarId,
    origin.toPlainDate(),
    adjustDateDuration(internal.date, Number(carriedDays)),
  );
  return {
    origin,
    target: targetDate
      .toPlainDateTime()
      .add({ nanoseconds: Number(timeOfDay) }),
  };
}

/** TC39 `DateDurationDays`. */
export function dateDurationDays(
  date: DateDuration,
  plain: Temporal.PlainDate,
): number {
  const yearsMonthsWeeks = adjustDateDuration(date, 0);
  if (dateDurationSign(yearsMonthsWeeks) === 0) return date.days;

  const isoDate = plain.withCalendar("iso8601");
  const later = calendarDateAdd(plain.calendarId, isoDate, yearsMonthsWeeks);
  return date.days + isoDate.until(later, { largestUnit: "day" }).days;
}

// ---------------------------------------------------------------------------------------------
// Whole operations by the spec: the spec paths for the nudge window, the day-correction and the no-value cases.
// Each `*AtLimit` returns the TC39 result, or null to re-throw the polyfill's error
// ---------------------------------------------------------------------------------------------

/** Runs `validate` (a polyfill call far from the limits); null when the options are invalid. */
export function optionsAreValid(validate: () => unknown): boolean {
  try {
    validate();
    return true;
  } catch {
    return false;
  }
}

function contextOf(zoned: Temporal.ZonedDateTime): Omit<ZonedContext, "wall"> {
  return { timeZone: zoned.timeZoneId, calendar: zoned.calendarId };
}

/** TC39 `DifferenceTemporalZonedDateTime(~until~, …)` for a date `largestUnit`. */
export function untilAtLimit(
  one: Temporal.ZonedDateTime,
  two: Temporal.ZonedDateTime,
  options: ZonedDifferenceOptions,
  settings: RoundingSettings,
): Temporal.Duration | null {
  if (
    !optionsAreValid(() => OPTIONS_PROBE.until(OPTIONS_PROBE, options)) ||
    !isDateUnit(settings.largestUnit) ||
    one.calendarId !== two.calendarId
  ) {
    return null;
  }

  const difference = differenceZonedDateTimeWithRounding(
    one.epochNanoseconds,
    two.epochNanoseconds,
    contextOf(one),
    settings,
  );
  return temporalDurationFromInternal(difference, "hour");
}

/** `Duration#total` with a zoned `relativeTo`: TC39 `DifferenceZonedDateTimeWithTotal`. */
export function totalAtLimit(
  duration: Temporal.Duration,
  zoned: Temporal.ZonedDateTime,
  unitOption: string,
  unit: Unit,
): number | null {
  if (
    !optionsAreValid(() =>
      ZERO_DURATION.total({
        unit: unitOption as never,
        relativeTo: OPTIONS_PROBE,
      }),
    )
  ) {
    return null;
  }

  const origin = zoned.epochNanoseconds;
  const target = addZonedDateTime(zoned, toInternalDuration(duration));
  if (!isDateUnit(unit)) {
    // TC39 TotalTimeDuration
    return divideToNumber(target - origin, NANOSECONDS_PER_TIME_UNIT[unit]);
  }

  const context = contextOf(zoned);
  const difference = differenceZonedDateTime(origin, target, context, unit);
  // TC39 TotalRelativeDuration: a calendar unit, or a day with a time zone.
  return nudgeToCalendarUnit(
    internalDurationSign(difference) < 0 ? -1 : 1,
    difference,
    origin,
    target,
    { ...context, wall: isoDateTimeFor(context.timeZone, origin) },
    1,
    unit,
    "trunc",
  ).total;
}

/** `Duration#round` with a zoned `relativeTo`. */
export function roundAtLimit(
  duration: Temporal.Duration,
  zoned: Temporal.ZonedDateTime,
  roundTo: DurationRoundOptions,
  settings: RoundingSettings,
): Temporal.Duration | null {
  if (!canRoundBySpec(roundTo, settings, OPTIONS_PROBE)) {
    return null;
  }

  const { largestUnit } = settings;
  const target = addZonedDateTime(zoned, toInternalDuration(duration));
  const rounded = differenceZonedDateTimeWithRounding(
    zoned.epochNanoseconds,
    target,
    contextOf(zoned),
    settings,
  );
  return temporalDurationFromInternal(
    rounded,
    isDateUnit(largestUnit) ? "hour" : largestUnit,
  );
}

/** `Temporal.Duration.compare` with a zoned `relativeTo`, when either operand has date units. */
export function compareAtLimit(
  one: Temporal.Duration,
  two: Temporal.Duration,
  zoned: Temporal.ZonedDateTime,
): number | null {
  if (
    !isDateUnit(defaultLargestUnit(one)) &&
    !isDateUnit(defaultLargestUnit(two))
  ) {
    return null;
  }

  const after1 = addZonedDateTime(zoned, toInternalDuration(one));
  const after2 = addZonedDateTime(zoned, toInternalDuration(two));
  return bigintSign(after1 - after2);
}

/** Resolves the units of `until`/`round` options; null when a unit name is not one Temporal knows. */
export function roundingSettings(
  largestUnitOption: unknown,
  smallestUnitOption: unknown,
  defaultLargestUnitFor: (smallestUnit: Unit) => Unit,
  increment: number | undefined,
  roundingMode: RoundingMode,
): RoundingSettings | null {
  const smallestUnit =
    smallestUnitOption === undefined
      ? "nanosecond"
      : toUnit(smallestUnitOption);
  if (smallestUnit === null) return null;

  const largestUnit =
    largestUnitOption === undefined || largestUnitOption === "auto"
      ? defaultLargestUnitFor(smallestUnit)
      : toUnit(largestUnitOption);
  if (largestUnit === null) return null;

  return {
    largestUnit,
    smallestUnit,
    increment: increment ?? 1,
    roundingMode,
  };
}

/** True when `Duration#round` accepts `roundTo` with `settings`, checked far from any limit. */
function canRoundBySpec(
  roundTo: DurationRoundOptions,
  settings: RoundingSettings,
  probe: Temporal.ZonedDateTime | Temporal.PlainDate,
): boolean {
  const { largestUnit, smallestUnit, increment } = settings;
  return (
    optionsAreValid(() =>
      ZERO_DURATION.round({
        ...roundTo,
        relativeTo: probe,
      } as DurationRoundTo),
    ) &&
    largerUnit(largestUnit, smallestUnit) === largestUnit &&
    !(increment > 1 && largestUnit !== smallestUnit && isDateUnit(smallestUnit))
  );
}

/** `Duration#total` with a plain `relativeTo`: TC39 `DifferencePlainDateTimeWithTotal`. */
export function totalWithPlainRelativeTo(
  duration: Temporal.Duration,
  plain: Temporal.PlainDate,
  unitOption: string,
  unit: Unit,
): number | null {
  if (
    !optionsAreValid(() =>
      ZERO_DURATION.total({
        unit: unitOption as never,
        relativeTo: PLAIN_DATE_PROBE,
      }),
    )
  ) {
    return null;
  }
  const { origin, target } = plainRelativeTarget(duration, plain);
  return differencePlainDateTimeWithTotal(
    origin,
    target,
    plain.calendarId,
    unit,
  );
}

/** `Duration#round` with a plain `relativeTo`: TC39 `DifferencePlainDateTimeWithRounding`. */
export function roundWithPlainRelativeTo(
  duration: Temporal.Duration,
  plain: Temporal.PlainDate,
  roundTo: DurationRoundOptions,
  settings: RoundingSettings,
): Temporal.Duration | null {
  if (!canRoundBySpec(roundTo, settings, PLAIN_DATE_PROBE)) {
    return null;
  }
  const { origin, target } = plainRelativeTarget(duration, plain);
  const rounded = differencePlainDateTimeWithRounding(
    origin,
    target,
    plain.calendarId,
    settings,
  );
  return temporalDurationFromInternal(
    rounded,
    isDateUnit(settings.largestUnit)
      ? "hour"
      : (settings.largestUnit as TimeUnit),
  );
}
