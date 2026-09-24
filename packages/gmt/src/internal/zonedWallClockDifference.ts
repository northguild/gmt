import { Temporal } from "@js-temporal/polyfill";
import type { DurationRelativeTo } from "../types";
import { TIME_ZONE_ANNOTATION } from "./isoStringBody";
import {
  MAX_EPOCH_NANOSECONDS,
  MIN_EPOCH_NANOSECONDS,
} from "./epochNanoseconds";
import {
  calendarDateAdd as compatCalendarDateAdd,
  calendarDateUntil as compatCalendarDateUntil,
  isCalendarArithmeticCompatNeeded,
  isNudgeWindowCompatNeeded,
} from "./temporalCompat";
import {
  epochNanosecondsFor,
  isNamedTimeZone,
  isValidEpoch,
  utcEpochNanoseconds,
  zonedDateTimeFrom,
} from "./zonedWallClock";

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
 * 1. **Wall-clock clamp** (defect 1 in `./zonedWallClock.ts`). In a named zone the polyfill throws
 *    `RangeError` for a wall clock whose UTC reading is past a limit although its exact time is
 *    in range, so e.g. `(max − 1 d).until(max, { largestUnit: "day" })` throws in Australia/Sydney
 *    where TC39 returns `P1D`. The same wrong clamp, plus a `CheckISODaysRange` the spec does not
 *    have, rejects the local dates of the minimum instant in zones behind UTC.
 *    - Trigger: the polyfill throws, the zone is a named non-UTC zone, and the operation reaches a
 *      limit. The TC39 result is then recomputed from the abstract operations mirrored below.
 *    - Retired by: at the maximum, polyfill commit 05ce7a3 ("Correctly handle limits in
 *      GetNamedTimeZoneEpochNanoseconds") once a release containing it is GMT's dependency floor.
 *      At the minimum, no upstream fix yet: a 0.5.1 build with 05ce7a3 applied still throws for
 *      the minimum-instant rows in `zonedWallClockDifference.test.ts` (New York, Honolulu).
 *    - Removal: once a polyfill release passes every row in `zonedWallClockDifference.test.ts`
 *      with the fallbacks disabled, delete the `*AtLimit` fallbacks and every mirrored abstract
 *      operation, and make each wrapper return its plain polyfill call.
 * 2. **UTC fast path without a validity check.** The polyfill's `GetPossibleEpochNanoseconds`
 *    returns `GetUTCEpochNanoseconds` for `"UTC"` without the `IsValidEpochNanoseconds` check the
 *    spec performs for every zone, so near the maximum a UTC rounding or total window that ends
 *    past the limit yields a value where TC39 throws (`+00:00` and IANA zones throw correctly).
 *    - Trigger: the zone is `"UTC"`, the polyfill returned a value, and the operation reaches a
 *      limit. The same call is repeated in the `+00:00` zone, which is identical to `"UTC"` in the
 *      spec but takes the validating offset-zone branch; if it throws, that error is thrown,
 *      otherwise the original UTC result is returned unchanged.
 *    - Retired by: no upstream fix yet (drafted as issue D in the CORE-6 polyfill research).
 *    - Removal: delete `checkUtcValidity` and its call in `runAtRangeLimit`.
 * 3. **Non-ISO calendar arithmetic** (CORE-6 D1–D7, see `./temporalCompat/README.md`). The
 *    polyfill's calendar `until` is wrong at month ends (D6), throws for Hebrew leap-month spans
 *    (D7) and near the range limits (D1), and reads buddhist, Hebrew <= 0 and Indian < 1 dates
 *    wrongly (D2–D5). A wrong difference is returned, not thrown, so no polyfill-first check can
 *    catch it.
 *    - Trigger: `isCalendarArithmeticCompatNeeded(calendar)` — one of that calendar's capability
 *      probes fails. `iso8601` never triggers it. The operation then takes the spec path below
 *      directly, and its two calendar seams (`calendarDateAdd`, `calendarDateUntil`) call the
 *      compat layer's entry points.
 *    - Retired by: the removal triggers in `./temporalCompat/README.md`; once every probe passes
 *      the trigger is false and the polyfill answers again.
 *    - Removal: delete the `isCalendarArithmeticCompatNeeded` terms in `zonedUntil`,
 *      `durationTotal`, `durationRound` and `durationCompare`, and the plain context's dispatch.
 *      The seams may keep calling the compat entry points, which are then the polyfill's calls.
 * 4. **The calendar nudge window is never retried** (D11). TC39 bounds a duration between
 *    `relativeTo + r1 units` and `relativeTo + r2 units`, taken from the duration's own count of
 *    that unit, and `NudgeToCalendarUnit` then checks that the target falls inside that window; when
 *    it does not, `ComputeNudgeWindow` runs again with `additionalShift`, so `r1` becomes 1 rather
 *    than 0. The polyfill computes the window once and never retries — its own
 *    `assert(start <= dest <= end)` is compiled out of production builds — so the answer is taken
 *    over bounds that do not contain the target. It reaches `Duration#total` (a wrong fraction:
 *    2024-01-31 to 2024-02-29T12:00 totals 1.0172413793103448 months where TC39 and Chromium 153
 *    give 1.0161290322580645), `Duration#round` and `until`/`since` with a calendar `smallestUnit`
 *    (a whole unit: the same span truncates to `PT0S` instead of `P1M`). Only a `relativeTo` or
 *    start past the 28th can reach it, because only there does adding a month constrain the day.
 *    - Trigger: `isNudgeWindowCompatNeeded()` — the D11 probe fails — with a "month" or "year" unit
 *      and a `relativeTo` on the 29th, 30th or 31st. The operation then takes the spec path below,
 *      the same `nudgeToCalendarUnit` the non-ISO calendars already use.
 *    - Retired by: a js-temporal release containing a port of proposal-temporal #3172
 *      (`5dd0b0d97ee1`, merged 2025-11-19), which is the fix for tc39/proposal-temporal#3168.
 *      Not on js-temporal `main` either, so no release alone will do it.
 *    - Removal: delete the `isNudgeWindowCompatNeeded` terms in `durationTotal`, `durationRound`,
 *      `zonedUntil`, `plainUntilWithRounding` and `internal/plainDateUntil.ts`, and the D11 rows in
 *      `./temporalCompat/repros.ts`. Keep the `progress === 0n` branch in `nudgeToCalendarUnit`:
 *      that is GMT's own bug, not the polyfill's.
 * ---------------------------------------------------------------------------------------------
 */

type DateUnit = "year" | "month" | "week" | "day";
type TimeUnit =
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "microsecond"
  | "nanosecond";
type Unit = DateUnit | TimeUnit;

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
const NANOSECONDS_PER_DAY = 24n * NANOSECONDS_PER_HOUR;

/** TC39 Table "Temporal units by descending magnitude", "Length in Nanoseconds" column. */
const NANOSECONDS_PER_TIME_UNIT: Record<TimeUnit, bigint> = {
  hour: NANOSECONDS_PER_HOUR,
  minute: 60_000_000_000n,
  second: 1_000_000_000n,
  millisecond: 1_000_000n,
  microsecond: 1_000n,
  nanosecond: 1n,
};

/** Upper bound on one unit's exact length in any zone: 366-day years, 31-day months, 2-day days. */
const UNIT_REACH: Record<Unit, bigint> = {
  year: 366n * NANOSECONDS_PER_DAY,
  month: 31n * NANOSECONDS_PER_DAY,
  week: 7n * NANOSECONDS_PER_DAY,
  day: 2n * NANOSECONDS_PER_DAY,
  ...NANOSECONDS_PER_TIME_UNIT,
};

/** A wall clock lies within a day of its exact time, and the offset probes look one day further. */
const LIMIT_MARGIN = 2n * NANOSECONDS_PER_DAY;

/** TC39 `maxTimeDuration`: 2^53 × 10^9 − 1 nanoseconds. */
const MAX_TIME_DURATION = 2n ** 53n * 1_000_000_000n - 1n;

/** The zone that resolves exactly like `"UTC"` in the spec but through the validating branch. */
const UTC_EQUIVALENT_OFFSET_ZONE = "+00:00";

/** Validates Temporal options exactly as the wrapped method does, far from any limit. */
const OPTIONS_PROBE = new Temporal.ZonedDateTime(0n, "UTC");
const ZERO_DURATION = new Temporal.Duration();

/** An RFC 9557 time zone annotation (`[Europe/London]`, `[!+01:00]`), never a `key=value` one. */
const timeZoneAnnotation = new RegExp(TIME_ZONE_ANNOTATION);

interface DateDuration {
  years: number;
  months: number;
  weeks: number;
  days: number;
}

/** TC39 Internal Duration Record. */
interface InternalDuration {
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
 * against the instant range (CORE-6 spec §3.6.3).
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

interface RoundingSettings {
  largestUnit: Unit;
  smallestUnit: Unit;
  increment: number;
  roundingMode: Temporal.RoundingMode;
}

type Sign = -1 | 1;
type UnsignedRoundingMode =
  | "zero"
  | "infinity"
  | "half-zero"
  | "half-infinity"
  | "half-even";

/** Options accepted by `ZonedDateTime#until`. */
export type ZonedDifferenceOptions =
  Temporal.DifferenceOptions<Temporal.DateTimeUnit>;

/** Options accepted by `Duration#round`, with GMT's `relativeTo` forms. */
export interface DurationRoundOptions {
  largestUnit?: Temporal.LargestUnit<Temporal.DateTimeUnit>;
  smallestUnit?: Temporal.SmallestUnit<Temporal.DateTimeUnit>;
  roundingIncrement?: number;
  roundingMode?: Temporal.RoundingMode;
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
function toUnit(value: unknown): Unit | null {
  if (typeof value !== "string") return null;
  const singular = value.endsWith("s") ? value.slice(0, -1) : value;
  return UNITS.find((unit) => unit === singular) ?? null;
}

/** TC39 `TemporalUnitCategory(unit)` is ~date~. */
function isDateUnit(unit: Unit): unit is DateUnit {
  return UNITS.indexOf(unit) <= UNITS.indexOf("day");
}

/** TC39 `LargerOfTwoTemporalUnits`. */
function largerUnit(one: Unit, two: Unit): Unit {
  return UNITS.indexOf(one) <= UNITS.indexOf(two) ? one : two;
}

function bigintSign(value: bigint): -1 | 0 | 1 {
  if (value < 0n) return -1;
  return value > 0n ? 1 : 0;
}

function bigintAbs(value: bigint): bigint {
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
function toInternalDuration(duration: Temporal.Duration): InternalDuration {
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
function defaultLargestUnit(duration: Temporal.Duration): Unit {
  return (
    UNITS.find((unit) => duration[`${unit}s` as const] !== 0) ?? "nanosecond"
  );
}

/** TC39 `GetUnsignedRoundingMode`, as [positive, negative]. */
const UNSIGNED_ROUNDING_MODES: Record<
  Temporal.RoundingMode,
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
  roundingMode: Temporal.RoundingMode,
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
  roundingMode: Temporal.RoundingMode,
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
function isoDateTimeFor(
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
function atTimeOf(
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
function calendarDateUntil(
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
function temporalDurationFromInternal(
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
      return {
        date: calendarDateUntil(
          context.calendar,
          startDate,
          intermediate.toPlainDate(),
          largerUnit(largestUnit, "day") as DateUnit,
        ),
        time,
      };
    }
  }

  throw new RangeError("More than the maximum day correction was needed");
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
  roundingMode: Temporal.RoundingMode,
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
  roundingMode: Temporal.RoundingMode,
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
function roundRelativeDuration(
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
// Plain context (defect 3, CORE-6 spec §3.6.3): no time zone, exact times are
// GetUTCEpochNanoseconds and are never checked against the instant range
// ---------------------------------------------------------------------------------------------

/** An ISO date far from the limits, used only to validate options. */
const PLAIN_DATE_PROBE = new Temporal.PlainDate(2000, 1, 1);
const PLAIN_DATE_TIME_PROBE = new Temporal.PlainDateTime(2000, 1, 1);

/** TC39 `IsCalendarUnit`. */
function isCalendarUnit(unit: Unit): unit is "year" | "month" | "week" {
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
  roundingMode: Temporal.RoundingMode,
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

function plainContext(
  calendar: string,
  wall: Temporal.PlainDateTime,
): RoundingContext {
  return { timeZone: undefined, calendar, wall };
}

/** TC39 `DifferencePlainDateTimeWithRounding`. */
function differencePlainDateTimeWithRounding(
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
function dateDurationDays(
  date: DateDuration,
  plain: Temporal.PlainDate,
): number {
  const yearsMonthsWeeks = adjustDateDuration(date, 0);
  if (dateDurationSign(yearsMonthsWeeks) === 0) return date.days;

  const isoDate = plain.withCalendar("iso8601");
  const later = calendarDateAdd(plain.calendarId, isoDate, yearsMonthsWeeks);
  return date.days + isoDate.until(later, { largestUnit: "day" }).days;
}

/**
 * `PlainDate#until(other, options)` with rounding options for two dates in one calendar, as TC39
 * `DifferenceTemporalPlainDate` computes it: `CalendarDateUntil` through the Temporal compat layer,
 * then — unless the granularity is one day — `RoundRelativeDuration` in a plain context.
 *
 * @param one the start, in the calendar to measure in
 * @param two the end, in the same calendar
 * @param options Temporal `largestUnit` / `smallestUnit` / `roundingIncrement` / `roundingMode`
 * @returns the rounded date duration; throws where TC39 Temporal throws
 */
export function plainDateUntilWithRounding(
  one: Temporal.PlainDate,
  two: Temporal.PlainDate,
  options: Temporal.DifferenceOptions<Temporal.DateUnit>,
): Temporal.Duration {
  // Validates the options exactly as PlainDate#until does, far from any limit.
  PLAIN_DATE_PROBE.until(PLAIN_DATE_PROBE, options);
  const settings = roundingSettings(
    options.largestUnit,
    options.smallestUnit ?? "day",
    (smallestUnit) => largerUnit("day", smallestUnit),
    options.roundingIncrement,
    options.roundingMode ?? "trunc",
  ) as RoundingSettings;
  if (Temporal.PlainDate.compare(one, two) === 0) {
    return new Temporal.Duration();
  }

  const calendar = one.calendarId;
  const start = one.withCalendar("iso8601").toPlainDateTime();
  const end = two.withCalendar("iso8601").toPlainDateTime();
  let duration: InternalDuration = {
    date: calendarDateUntil(
      calendar,
      start.toPlainDate(),
      end.toPlainDate(),
      settings.largestUnit as DateUnit,
    ),
    time: 0n,
  };
  if (settings.smallestUnit !== "day" || settings.increment !== 1) {
    duration = roundRelativeDuration(
      duration,
      utcEpochNanoseconds(start),
      utcEpochNanoseconds(end),
      plainContext(calendar, start),
      settings,
    );
  }

  const { years, months, weeks, days } = duration.date;
  return new Temporal.Duration(years, months, weeks, days);
}

// ---------------------------------------------------------------------------------------------
// Fallbacks (defect 1): the TC39 result, or null to re-throw the polyfill's error
// ---------------------------------------------------------------------------------------------

/** Runs `validate` (a polyfill call far from the limits); null when the options are invalid. */
function optionsAreValid(validate: () => unknown): boolean {
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
function untilAtLimit(
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
function totalAtLimit(
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
function roundAtLimit(
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
function compareAtLimit(
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

// ---------------------------------------------------------------------------------------------
// Polyfill-first wrappers
// ---------------------------------------------------------------------------------------------

/** True when `epochs`, widened by `reach` and the limit margin, touch either range limit. */
function reachesRangeLimit(epochs: readonly bigint[], reach: bigint): boolean {
  const widen = reach + LIMIT_MARGIN;
  return epochs.some(
    (epoch) =>
      epoch - widen <= MIN_EPOCH_NANOSECONDS ||
      epoch + widen >= MAX_EPOCH_NANOSECONDS,
  );
}

/** An upper bound on how far `duration` moves an exact time in any zone. */
function durationReach(duration: Temporal.Duration): bigint {
  const { date, time } = toInternalDuration(duration);
  return (
    BigInt(Math.abs(date.years)) * UNIT_REACH.year +
    BigInt(Math.abs(date.months)) * UNIT_REACH.month +
    BigInt(Math.abs(date.weeks)) * UNIT_REACH.week +
    BigInt(Math.abs(date.days)) * UNIT_REACH.day +
    bigintAbs(time)
  );
}

/** How far rounding can look past its destination: one increment, then bubbling to `largestUnit`. */
function roundingReach(settings: RoundingSettings): bigint {
  const increment = Number.isSafeInteger(settings.increment)
    ? Math.abs(settings.increment)
    : 1;
  return (
    UNIT_REACH[settings.largestUnit] +
    BigInt(Math.max(increment, 1)) * UNIT_REACH[settings.smallestUnit]
  );
}

/** Resolves the units of `until`/`round` options; null when a unit name is not one Temporal knows. */
function roundingSettings(
  largestUnitOption: unknown,
  smallestUnitOption: unknown,
  defaultLargestUnitFor: (smallestUnit: Unit) => Unit,
  increment: number | undefined,
  roundingMode: Temporal.RoundingMode,
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

/** Defect 2: the spec validates every UTC exact time; `+00:00` resolves identically and does. */
function checkUtcValidity(compute: (timeZone: string) => unknown): void {
  compute(UTC_EQUIVALENT_OFFSET_ZONE);
}

/**
 * Returns `compute(timeZone)`, the polyfill's own result, unchanged. Near a range limit only:
 * a UTC result is checked with `checkUtcValidity` (defect 2), and a named zone's error is
 * replaced by `fallback`'s TC39 result when it has one (defect 1).
 */
function runAtRangeLimit<T>(
  timeZone: string,
  atRangeLimit: boolean,
  compute: (timeZone: string) => T,
  fallback: () => T | null,
): T {
  let result: T;
  try {
    result = compute(timeZone);
  } catch (error) {
    if (!atRangeLimit || !isNamedTimeZone(timeZone)) throw error;
    const recovered = fallback();
    if (recovered === null) throw error;
    return recovered;
  }

  if (atRangeLimit && timeZone === "UTC") {
    checkUtcValidity(compute);
  }
  return result;
}

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
      typeof relativeTo === "object" &&
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
 * "day lengths can vary between time zones due to DST". `ZonedDateTime#equals` applies TC39
 * TimeZoneEquals, so `UTC` equals `Etc/UTC` and `Asia/Calcutta` equals `Asia/Kolkata`.
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
  return !new Temporal.ZonedDateTime(0n, one.timeZoneId).equals(
    new Temporal.ZonedDateTime(0n, two.timeZoneId),
  );
}

/**
 * `ZonedDateTime#until`, correct at the range limits (see the note at the top of this file).
 *
 * @param one the start
 * @param two the end
 * @param options Temporal `largestUnit` / `smallestUnit` / `roundingIncrement` / `roundingMode`
 * @returns the difference; throws where TC39 Temporal throws
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
  // Defect 3: a calendar whose arithmetic the polyfill gets wrong takes the spec path outright,
  // because a wrong month-end difference (D6) is returned, not thrown.
  if (
    settings !== null &&
    one.timeZoneId === two.timeZoneId &&
    one.calendarId === two.calendarId &&
    isCalendarArithmeticCompatNeeded(one.calendarId)
  ) {
    const bySpec = untilAtLimit(one, two, options, settings);
    if (bySpec !== null) return bySpec;
  }

  // Defect 4: the polyfill rounds over a nudge window that need not contain the target, so a
  // calendar `smallestUnit` from a day that a month add would constrain takes the spec path too.
  if (
    settings !== null &&
    one.timeZoneId === two.timeZoneId &&
    one.calendarId === two.calendarId &&
    isNudgeWindowUnit(settings.smallestUnit) &&
    one.day >= 29 &&
    isNudgeWindowCompatNeeded()
  ) {
    const bySpec = untilAtLimit(one, two, options, settings);
    if (bySpec !== null) return bySpec;
  }

  const atRangeLimit =
    settings !== null &&
    one.timeZoneId === two.timeZoneId &&
    reachesRangeLimit(
      [one.epochNanoseconds, two.epochNanoseconds],
      roundingReach(settings),
    );

  return runAtRangeLimit(
    one.timeZoneId,
    atRangeLimit,
    (timeZone) =>
      inTimeZone(one, timeZone).until(inTimeZone(two, timeZone), options),
    () => untilAtLimit(one, two, options, settings as RoundingSettings),
  );
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
      } as Temporal.DurationRoundTo),
    ) &&
    largerUnit(largestUnit, smallestUnit) === largestUnit &&
    !(increment > 1 && largestUnit !== smallestUnit && isDateUnit(smallestUnit))
  );
}

/**
 * The plain `relativeTo` Temporal would resolve (TC39 `ToRelativeTemporalObject` keeps only the
 * date) when its calendar needs the Temporal compat layer in this runtime, or null. A string with
 * no calendar annotation is ISO, so it is never parsed here.
 */
function plainRelativeToNeedingCompat(
  relativeTo: DurationRelativeTo | undefined,
): Temporal.PlainDate | null {
  let plain: Temporal.PlainDate;
  try {
    if (relativeTo instanceof Temporal.PlainDateTime) {
      plain = relativeTo.toPlainDate();
    } else if (
      typeof relativeTo === "string" &&
      relativeTo.includes("u-ca=") &&
      !timeZoneAnnotation.test(relativeTo)
    ) {
      plain = Temporal.PlainDate.from(relativeTo);
    } else {
      return null;
    }
  } catch {
    return null;
  }
  return isCalendarArithmeticCompatNeeded(plain.calendarId) ? plain : null;
}

/** `Duration#total` with a plain `relativeTo`: TC39 `DifferencePlainDateTimeWithTotal`. */
function totalWithPlainRelativeTo(
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
function roundWithPlainRelativeTo(
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

/** `Temporal.Duration.compare` with a plain `relativeTo`, when either operand has calendar units. */
function compareWithPlainRelativeTo(
  one: Temporal.Duration,
  two: Temporal.Duration,
  plain: Temporal.PlainDate,
): number | null {
  if (
    !isCalendarUnit(defaultLargestUnit(one)) &&
    !isCalendarUnit(defaultLargestUnit(two))
  ) {
    return null;
  }
  const first = toInternalDuration(one);
  const second = toInternalDuration(two);
  const time1 =
    first.time +
    BigInt(dateDurationDays(first.date, plain)) * NANOSECONDS_PER_DAY;
  const time2 =
    second.time +
    BigInt(dateDurationDays(second.date, plain)) * NANOSECONDS_PER_DAY;
  return bigintSign(time1 - time2);
}

/** Defect 3: `Duration#total` by the spec when the `relativeTo` calendar needs the compat layer. */
function calendarTotalBySpec(
  duration: Temporal.Duration,
  unitOption: string,
  unit: Unit,
  relativeTo: DurationRelativeTo | undefined,
  zoned: Temporal.ZonedDateTime | null,
): number | null {
  if (zoned !== null) {
    return isCalendarArithmeticCompatNeeded(zoned.calendarId)
      ? totalAtLimit(duration, zoned, unitOption, unit)
      : null;
  }
  const plain = plainRelativeToNeedingCompat(relativeTo);
  return plain === null
    ? null
    : totalWithPlainRelativeTo(duration, plain, unitOption, unit);
}

/**
 * Units whose nudge window can miss its target: only a month, or a year that carries months with it.
 * A week or a day is a fixed count of days, so `relativeTo + r1 units` never has to constrain.
 */
function isNudgeWindowUnit(unit: Unit | undefined): boolean {
  return unit === "month" || unit === "year";
}

/**
 * The day of month a `relativeTo` resolves to, or 0 when there is none to read.
 *
 * Only the 29th, 30th and 31st can reach defect 4: below that, adding a month never constrains
 * the day, so the two denominators coincide and the polyfill's answer is already the spec's.
 */
function relativeToDayOfMonth(
  relativeTo: DurationRelativeTo | undefined,
  zoned: Temporal.ZonedDateTime | null,
): number {
  if (zoned !== null) {
    return zoned.day;
  }
  try {
    if (relativeTo instanceof Temporal.PlainDateTime) {
      return relativeTo.day;
    }
    if (relativeTo instanceof Temporal.PlainDate) {
      return relativeTo.day;
    }
    if (typeof relativeTo === "string") {
      return Temporal.PlainDate.from(relativeTo).day;
    }
    if (relativeTo !== null && typeof relativeTo === "object") {
      return Temporal.PlainDate.from(relativeTo as never).day;
    }
  } catch {
    return 0;
  }
  return 0;
}

/** The plain `relativeTo` Temporal would resolve, whatever its calendar, or null. */
function plainRelativeTo(
  relativeTo: DurationRelativeTo | undefined,
): Temporal.PlainDate | null {
  try {
    if (relativeTo instanceof Temporal.PlainDate) {
      return relativeTo;
    }
    if (relativeTo instanceof Temporal.PlainDateTime) {
      return relativeTo.toPlainDate();
    }
    if (
      typeof relativeTo === "string" &&
      !timeZoneAnnotation.test(relativeTo)
    ) {
      return Temporal.PlainDate.from(relativeTo);
    }
    if (
      relativeTo !== null &&
      typeof relativeTo === "object" &&
      !(relativeTo instanceof Temporal.ZonedDateTime)
    ) {
      return Temporal.PlainDate.from(relativeTo as never);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Defect 4: `Duration#total` by the spec when the polyfill would divide the month fraction by the
 * wrong month. Returns null whenever the defect cannot apply, leaving the polyfill's own answer.
 */
function monthTotalBySpec(
  duration: Temporal.Duration,
  unitOption: string,
  unit: Unit,
  relativeTo: DurationRelativeTo | undefined,
  zoned: Temporal.ZonedDateTime | null,
): number | null {
  if (
    !isNudgeWindowUnit(unit) ||
    relativeToDayOfMonth(relativeTo, zoned) < 29 ||
    !isNudgeWindowCompatNeeded()
  ) {
    return null;
  }
  if (zoned !== null) {
    return totalAtLimit(duration, zoned, unitOption, unit);
  }
  const plain = plainRelativeTo(relativeTo);
  return plain === null
    ? null
    : totalWithPlainRelativeTo(duration, plain, unitOption, unit);
}

/**
 * Defect 4: `Duration#round` by the spec when the polyfill would round over a nudge window that
 * does not contain the target. Returns null whenever the defect cannot apply, leaving the
 * polyfill's own answer.
 */
function monthRoundBySpec(
  duration: Temporal.Duration,
  roundTo: DurationRoundOptions,
  settings: RoundingSettings,
  zoned: Temporal.ZonedDateTime | null,
): Temporal.Duration | null {
  if (
    !isNudgeWindowUnit(settings.smallestUnit) ||
    relativeToDayOfMonth(roundTo.relativeTo, zoned) < 29 ||
    !isNudgeWindowCompatNeeded()
  ) {
    return null;
  }
  if (zoned !== null) {
    return roundAtLimit(duration, zoned, roundTo, settings);
  }
  const plain = plainRelativeTo(roundTo.relativeTo);
  return plain === null
    ? null
    : roundWithPlainRelativeTo(duration, plain, roundTo, settings);
}

/** Defect 3: `Duration#round` by the spec when the `relativeTo` calendar needs the compat layer. */
function calendarRoundBySpec(
  duration: Temporal.Duration,
  roundTo: DurationRoundOptions,
  settings: RoundingSettings,
  zoned: Temporal.ZonedDateTime | null,
): Temporal.Duration | null {
  if (zoned !== null) {
    return isCalendarArithmeticCompatNeeded(zoned.calendarId)
      ? roundAtLimit(duration, zoned, roundTo, settings)
      : null;
  }
  const plain = plainRelativeToNeedingCompat(roundTo.relativeTo);
  return plain === null
    ? null
    : roundWithPlainRelativeTo(duration, plain, roundTo, settings);
}

/** Defect 3: `Duration.compare` by the spec when the `relativeTo` calendar needs the compat layer. */
function calendarCompareBySpec(
  one: Temporal.Duration | string,
  two: Temporal.Duration | string,
  relativeTo: DurationRelativeTo | undefined,
  zoned: Temporal.ZonedDateTime | null,
): number | null {
  if (zoned !== null) {
    return isCalendarArithmeticCompatNeeded(zoned.calendarId)
      ? compareAtLimit(
          Temporal.Duration.from(one),
          Temporal.Duration.from(two),
          zoned,
        )
      : null;
  }
  const plain = plainRelativeToNeedingCompat(relativeTo);
  return plain === null
    ? null
    : compareWithPlainRelativeTo(
        Temporal.Duration.from(one),
        Temporal.Duration.from(two),
        plain,
      );
}

/**
 * `PlainDateTime#until` / `#since`, correct when the polyfill would round over a nudge window that
 * does not contain the target (defect 4).
 *
 * The plain difference functions round through the polyfill directly, because neither the range
 * limits nor the non-ISO calendars reach them the way they reach the zoned ones. A calendar
 * `smallestUnit` measured from a day that a month add would constrain is the one case that does, so
 * it takes the spec path and everything else stays the polyfill's own call.
 *
 * @param one the earlier plain datetime
 * @param two the later plain datetime
 * @param options Temporal difference options, passed through unchanged when the defect cannot apply
 * @returns the difference; throws where TC39 Temporal throws
 */
export function plainUntilWithRounding(
  one: Temporal.PlainDateTime,
  two: Temporal.PlainDateTime,
  options: {
    largestUnit?: unknown;
    smallestUnit?: unknown;
    roundingIncrement?: number;
    roundingMode?: Temporal.RoundingMode;
  } = {},
): Temporal.Duration {
  const settings = roundingSettings(
    options.largestUnit,
    options.smallestUnit,
    (smallestUnit) => largerUnit("hour", smallestUnit),
    options.roundingIncrement,
    options.roundingMode ?? "trunc",
  );

  if (
    settings !== null &&
    isNudgeWindowUnit(settings.smallestUnit) &&
    one.day >= 29 &&
    one.calendarId === two.calendarId &&
    Temporal.PlainDateTime.compare(one, two) <= 0 &&
    isNudgeWindowCompatNeeded() &&
    optionsAreValid(() =>
      PLAIN_DATE_TIME_PROBE.until(PLAIN_DATE_TIME_PROBE, options as never),
    )
  ) {
    const rounded = differencePlainDateTimeWithRounding(
      one,
      two,
      one.calendarId,
      settings,
    );
    return temporalDurationFromInternal(
      rounded,
      isDateUnit(settings.largestUnit)
        ? "hour"
        : (settings.largestUnit as TimeUnit),
    );
  }

  return one.until(
    two,
    options as Temporal.DifferenceOptions<Temporal.DateTimeUnit>,
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
  const bySpec =
    resolvedUnit === null
      ? null
      : calendarTotalBySpec(duration, unit, resolvedUnit, relativeTo, zoned);
  if (bySpec !== null) {
    return bySpec;
  }

  // Defect 4: the polyfill's month fraction, when the day can be constrained.
  const byMonthSpec =
    resolvedUnit === null
      ? null
      : monthTotalBySpec(duration, unit, resolvedUnit, relativeTo, zoned);
  if (byMonthSpec !== null) {
    return byMonthSpec;
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
    zoned.timeZoneId,
    atRangeLimit,
    (timeZone) =>
      duration.total({ unit, relativeTo: inTimeZone(zoned, timeZone) }),
    () => totalAtLimit(duration, zoned, unit, resolvedUnit as Unit),
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
  const bySpec =
    settings === null
      ? null
      : calendarRoundBySpec(duration, roundTo, settings, zoned);
  if (bySpec !== null) {
    return bySpec;
  }

  // Defect 4: the polyfill's nudge window, when the day can be constrained.
  const byNudgeSpec =
    settings === null
      ? null
      : monthRoundBySpec(duration, roundTo, settings, zoned);
  if (byNudgeSpec !== null) {
    return byNudgeSpec;
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
    zoned.timeZoneId,
    atRangeLimit,
    (timeZone) =>
      duration.round({
        ...roundTo,
        relativeTo: inTimeZone(zoned, timeZone),
      } as Temporal.DurationRoundTo),
    () => roundAtLimit(duration, zoned, roundTo, settings as RoundingSettings),
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
  const bySpec = calendarCompareBySpec(one, two, relativeTo, zoned);
  if (bySpec !== null) {
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
    zoned.timeZoneId,
    reachesRangeLimit([zoned.epochNanoseconds], reach),
    (timeZone) =>
      Temporal.Duration.compare(first, second, {
        relativeTo: inTimeZone(zoned, timeZone),
      }),
    () => compareAtLimit(first, second, zoned),
  );
}
