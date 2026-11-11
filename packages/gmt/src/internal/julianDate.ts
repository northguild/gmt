import type { JulianDateParts, TimeScale } from "../types/time-scale";
import { floorDivide } from "./floorDivide";
import { NANOSECONDS_PER_DAY, NANOSECONDS_PER_SECOND } from "./foreignEpochs";
import {
  LEAP_SECOND_STEPS,
  type LeapSecondSteps,
  taiOfUtc,
  utcDayLengthNanoseconds,
  utcOfTai,
} from "./leapSeconds";
import {
  tcgMinusTtNanoseconds,
  TT_MINUS_TAI_NANOSECONDS,
  ttOfTcg,
  utcOfTt,
} from "./terrestrialTime";
import { LAST_FOUR_DIGIT_UTC_NANOSECONDS, type UtcReading } from "./utcReading";

/**
 * The core of the Julian Date family: a UTC reading on one of four scales as a position in a day,
 * and back. Pure bigint and number arithmetic: no Temporal call, nothing at import. The only
 * loops are bounded: the leap-second scans (the 28-row table) and the trailing-zero reduction in
 * `exactDyadic` (at most 52 iterations, a 53-bit significand).
 *
 * Sources: IAU 1997 Resolution B1 Appendix 2 (JD counts days from noon); ERFA `dtf2d.c` Notes 3-4
 * (quasi-JD on UTC); IEEE 754-2019 §4.3 (one correctly rounded division); TC39 Temporal
 * `halfExpand` (the nanosecond rounding).
 */

/** MJD of 1970-01-01: the days from 1858-11-17 (ITU-R TF.457-2 Rec. 2; ERFA `ERFA_DJM0`). */
export const MJD_OF_UNIX_EPOCH = 40_587n;

/** Twice 2440587.5, the JD of 1970-01-01T00:00 (ERFA `ERFA_DJM0` with MJD 40587). */
export const JD_OF_UNIX_EPOCH_MIDNIGHT_HALF_DAYS = 4_881_175n;

/** Days from 1970-01-01 to 2000-01-01 (J2000.0 is at noon of this day, IAU 1994 C7 Rec. 1). */
export const J2000_EPOCH_DAY = 10_957n;

/** 1972-01-01T00:00:00Z: where whole-second TAI − UTC begins, the lower bound of the domain. */
export const UTC_JD_FLOOR_NANOSECONDS: bigint = LEAP_SECOND_STEPS.at[0];

/** The first epoch day inside the slack: 1971-12-31 (one day under the floor, day 730). */
const MIN_SLACK_EPOCH_DAY = 729n;

/** The last epoch day inside the slack: 10000-01-01 (one day over 9999-12-31, day 2 932 896). */
const MAX_SLACK_EPOCH_DAY = 2_932_897n;

/** A position in a day on one scale's own label. */
export interface DayPosition {
  /** Days since 1970-01-01 on the scale's own label. */
  readonly epochDay: bigint;
  /** Nanoseconds into the day, from 0 up to but not including `dayLength`. */
  readonly nanosOfDay: bigint;
  /** `NANOSECONDS_PER_DAY`, or 86 401 s on a UTC leap-second day. */
  readonly dayLength: bigint;
}

const TIME_SCALES: Readonly<Record<TimeScale, true>> = Object.freeze({
  UTC: true,
  TAI: true,
  TT: true,
  TCG: true,
});

/**
 * Whether a value is one of the four time scales a Julian Date can be taken on.
 *
 * @param value candidate scale
 * @returns true for `UTC`, `TAI`, `TT` or `TCG`
 */
export function isTimeScale(value: unknown): value is TimeScale {
  return typeof value === "string" && Object.hasOwn(TIME_SCALES, value);
}

/**
 * A UTC reading as a position in a day on a scale.
 *
 * On TAI, TT and TCG the day is the scale's own label day, 86 400 s long. On UTC it is the UTC
 * day, which holds 86 401 s when a second is inserted at its end (ERFA `dtf2d.c` Note 4).
 *
 * @param steps the leap-second table
 * @param reading the UTC reading
 * @param scale the scale to count on
 * @returns the day position, or null outside 1972-01-01 to 9999-12-31 or for a reading that has no TAI instant
 */
export function dayPositionOf(
  steps: LeapSecondSteps,
  reading: UtcReading,
  scale: TimeScale,
): DayPosition | null {
  if (
    reading.epochNanoseconds < UTC_JD_FLOOR_NANOSECONDS ||
    reading.epochNanoseconds > LAST_FOUR_DIGIT_UTC_NANOSECONDS
  ) {
    return null;
  }
  const tai = taiOfUtc(steps, reading);
  if (tai === null) {
    return null;
  }

  if (scale === "UTC") {
    const epochDay = floorDivide(reading.epochNanoseconds, NANOSECONDS_PER_DAY);
    const rest = reading.epochNanoseconds - epochDay * NANOSECONDS_PER_DAY;
    return {
      epochDay,
      nanosOfDay: reading.secondSixty ? rest + NANOSECONDS_PER_SECOND : rest,
      dayLength: utcDayLengthNanoseconds(steps, epochDay),
    };
  }

  let label = tai;
  if (scale !== "TAI") {
    label = tai + TT_MINUS_TAI_NANOSECONDS;
    if (scale === "TCG") {
      label += tcgMinusTtNanoseconds(label);
    }
  }
  const epochDay = floorDivide(label, NANOSECONDS_PER_DAY);
  return {
    epochDay,
    nanosOfDay: label - epochDay * NANOSECONDS_PER_DAY,
    dayLength: NANOSECONDS_PER_DAY,
  };
}

/**
 * The UTC reading of a day position: the inverse of `dayPositionOf`.
 *
 * @param steps the leap-second table
 * @param epochDay days since 1970-01-01 on the scale's label
 * @param nanosOfDay rounded nanoseconds into the day, below the day's length
 * @param scale the scale the position is on
 * @returns the UTC reading, or null before 1972-01-01 (the caller's `formatUtcReading` bounds the other end)
 */
export function readingOfDayPosition(
  steps: LeapSecondSteps,
  epochDay: bigint,
  nanosOfDay: bigint,
  scale: TimeScale,
): UtcReading | null {
  const label = epochDay * NANOSECONDS_PER_DAY + nanosOfDay;
  if (scale === "UTC") {
    if (label < UTC_JD_FLOOR_NANOSECONDS) {
      return null;
    }
    return nanosOfDay >= NANOSECONDS_PER_DAY
      ? {
          epochNanoseconds: label - NANOSECONDS_PER_SECOND,
          secondSixty: true,
        }
      : { epochNanoseconds: label, secondSixty: false };
  }
  if (scale === "TAI") {
    return utcOfTai(steps, label);
  }
  return utcOfTt(steps, scale === "TT" ? label : ttOfTcg(label));
}

/**
 * A finite double as `numerator / 2^exponent`, exactly, with `exponent ≥ 0` and the fraction
 * reduced (an odd numerator unless the exponent is 0). Reads the sign, the 11-bit exponent and the
 * 52-bit significand (IEEE 754-2019 §3.4); handles subnormals and ±0. Non-finite values are the
 * caller's to reject.
 *
 * @param x a finite number
 * @returns the exact numerator and power-of-two exponent
 */
export function exactDyadic(x: number): {
  numerator: bigint;
  exponent: bigint;
} {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const negative = bits >> 63n === 1n;
  const biased = (bits >> 52n) & 0x7ffn;
  const fraction = bits & 0xf_ffff_ffff_ffffn;
  let numerator = biased === 0n ? fraction : fraction | (1n << 52n);
  // Value = numerator × 2^(e − 1075), where e is the biased exponent, or 1 for a subnormal.
  let power = (biased === 0n ? 1n : biased) - 1075n;
  if (numerator === 0n) {
    return { numerator: 0n, exponent: 0n };
  }
  // Bounded: a nonzero significand has at most 52 trailing zero bits (coding-standards § Loop cost).
  while ((numerator & 1n) === 0n && power < 0n) {
    numerator >>= 1n;
    power += 1n;
  }
  if (power >= 0n) {
    numerator <<= power;
    power = 0n;
  }
  return { numerator: negative ? -numerator : numerator, exponent: -power };
}

/**
 * The double nearest the exact rational `numerator / denominator`, ties to the even significand
 * (IEEE 754-2019 §4.3.1 roundTiesToEven): the one rounding the J2000-seconds output takes.
 *
 * Why it is exact: with `e = floor(log2(|numerator| / denominator))`, the doubles in `[2^e, 2^(e+1))`
 * are exactly `j × 2^-k` for whole `j` in `[2^52, 2^53)`, where `k = 52 − e`. So the nearest double is
 * `round(x) × 2^-k` with `x = |numerator| × 2^k / denominator` in `[2^52, 2^53)`, rounded half to
 * even once, in bigint. A round up to `2^53` is `2^(e+1)`, the next binade's first double, whose
 * significand is even. `j ≤ 2^53` converts to a double exactly, and scaling by a power of two is exact
 * while the result stays normal, so no second rounding happens.
 *
 * The result must be normal (`2^-1022 ≤ |value| < 2^1024`); the J2000 counts, from 1 ns to about
 * 2.6 × 10^11 s, are.
 *
 * @param numerator any bigint
 * @param denominator a positive bigint
 * @returns the correctly rounded double, `0` for a zero numerator
 */
export function nearestDouble(numerator: bigint, denominator: bigint): number {
  if (numerator === 0n) {
    return 0;
  }
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  // magnitude in [2^(a−1), 2^a) and denominator in [2^(b−1), 2^b), so the ratio lies in
  // (2^(a−b−1), 2^(a−b+1)): its binade e is a − b or a − b − 1, and one comparison decides.
  const guess = magnitude.toString(2).length - denominator.toString(2).length;
  const reachesGuess =
    guess >= 0
      ? magnitude >= denominator << BigInt(guess)
      : magnitude << BigInt(-guess) >= denominator;
  const shift = BigInt(52 - (reachesGuess ? guess : guess - 1));
  const top = shift >= 0n ? magnitude << shift : magnitude;
  const bottom = shift >= 0n ? denominator : denominator << -shift;
  let significand = top / bottom;
  const twiceRemainder = 2n * (top - significand * bottom);
  if (
    twiceRemainder > bottom ||
    (twiceRemainder === bottom && (significand & 1n) === 1n)
  ) {
    significand += 1n;
  }
  // significand ≤ 2^53 converts exactly. A normal result has shift ≤ 1074, but 2^shift is a
  // finite double only up to 2^1023, so a larger shift divides in two steps: 2^52 / 2^1023 is
  // 2^-971, still normal, and the second step lands on the normal result. Each division only
  // scales by a power of two: exact. For shift < 0 the shifted integer still has at most 53
  // significant bits, so it converts exactly too.
  let value: number;
  if (shift < 0n) {
    value = Number(significand << -shift);
  } else if (shift <= 1023n) {
    value = Number(significand) / Number(1n << shift);
  } else {
    value =
      Number(significand) / Number(1n << 1023n) / Number(1n << (shift - 1023n));
  }
  return negative ? -value : value;
}

/**
 * Days since 1970-01-01T00:00 on a scale, given as an exact fraction, as a day position rounded to
 * the nearest nanosecond (a half rounds up).
 *
 * @param daysNumerator numerator of the day count
 * @param daysDenominator denominator of the day count, positive
 * @param steps the leap-second table
 * @param scale the scale the count is on
 * @returns the day position, or null when the day lies outside 1971-12-31 to 10000-01-01
 */
export function dayPositionOfDays(
  daysNumerator: bigint,
  daysDenominator: bigint,
  steps: LeapSecondSteps,
  scale: TimeScale,
): Omit<DayPosition, "dayLength"> | null {
  const epochDay = floorDivide(daysNumerator, daysDenominator);
  if (epochDay < MIN_SLACK_EPOCH_DAY || epochDay > MAX_SLACK_EPOCH_DAY) {
    return null;
  }
  const rest = daysNumerator - epochDay * daysDenominator;
  const dayLength =
    scale === "UTC"
      ? utcDayLengthNanoseconds(steps, epochDay)
      : NANOSECONDS_PER_DAY;
  const nanosOfDay = floorDivide(
    2n * rest * dayLength + daysDenominator,
    2n * daysDenominator,
  );
  if (nanosOfDay === dayLength) {
    return { epochDay: epochDay + 1n, nanosOfDay: 0n };
  }
  return { epochDay, nanosOfDay };
}

/** Days since 1970-01-01T00:00 on a scale's label, as the exact fraction `numerator / denominator`. */
export interface EpochDays {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

/**
 * The exact days since 1970-01-01T00:00 that a Julian Date double names (JD − 2440587.5).
 *
 * @param jd a finite number
 * @returns the exact day count
 */
export function epochDaysOfJulianDate(jd: number): EpochDays {
  const value = exactDyadic(jd);
  // Common denominator 2^k; k ≥ 1 because the epoch constant is a half.
  let exponent = 1n;
  if (value.exponent > exponent) {
    exponent = value.exponent;
  }
  const denominator = 1n << exponent;
  return {
    numerator:
      value.numerator * (denominator >> value.exponent) -
      JD_OF_UNIX_EPOCH_MIDNIGHT_HALF_DAYS * (denominator >> 1n),
    denominator,
  };
}

/**
 * The exact days since 1970-01-01T00:00 that a Modified Julian Date double names (MJD − 40587).
 *
 * @param mjd a finite number
 * @returns the exact day count
 */
export function epochDaysOfModifiedJulianDate(mjd: number): EpochDays {
  const { numerator, exponent } = exactDyadic(mjd);
  const denominator = 1n << exponent;
  return {
    numerator: numerator - MJD_OF_UNIX_EPOCH * denominator,
    denominator,
  };
}

/**
 * The exact days since 1970-01-01T00:00 that a count of seconds since J2000.0 names.
 *
 * @param seconds a finite number
 * @returns the exact day count
 */
export function epochDaysOfJ2000Seconds(seconds: number): EpochDays {
  const { numerator, exponent } = exactDyadic(seconds);
  const denominator = 86_400n << exponent;
  return {
    numerator:
      numerator + 43_200n * (1n << exponent) + J2000_EPOCH_DAY * denominator,
    denominator,
  };
}

/**
 * Whether a day count reads back as a UTC instant inside the domain (1972-01-01T00:00:00Z to
 * 9999-12-31T23:59:59.999999999Z) on a scale: the same path every `from*` takes, so a `to*` can
 * refuse a double its `from*` would reject.
 *
 * @param days the exact day count
 * @param steps the leap-second table
 * @param scale the scale the count is on
 * @returns true when the day count reads as an instant in the domain
 */
export function readsBackInDomain(
  days: EpochDays,
  steps: LeapSecondSteps,
  scale: TimeScale,
): boolean {
  const position = dayPositionOfDays(
    days.numerator,
    days.denominator,
    steps,
    scale,
  );
  if (position === null) {
    return false;
  }
  const reading = readingOfDayPosition(
    steps,
    position.epochDay,
    position.nanosOfDay,
    scale,
  );
  return (
    reading !== null &&
    reading.epochNanoseconds <= LAST_FOUR_DIGIT_UTC_NANOSECONDS
  );
}

/**
 * The part of the day gone, as one correctly rounded division (both operands are below 2⁵³).
 *
 * @param position the day position
 * @returns a number from 0 up to but not including 1
 */
export function fractionOfDay(position: DayPosition): number {
  return Number(position.nanosOfDay) / Number(position.dayLength);
}

/**
 * A day position as two-part Julian Date: `jd1` a whole number, `jd2` in [0, 1), split at noon
 * (IAU 1997 B1 App. 2: the JD counts from the preceding noon). `jd2` is one division.
 *
 * @param position the day position
 * @returns the two parts
 */
export function julianDatePartsOf(position: DayPosition): JulianDateParts {
  const { epochDay, nanosOfDay, dayLength } = position;
  if (2n * nanosOfDay >= dayLength) {
    return {
      jd1: 2_440_588 + Number(epochDay),
      jd2: Number(2n * nanosOfDay - dayLength) / Number(2n * dayLength),
    };
  }
  return {
    jd1: 2_440_587 + Number(epochDay),
    jd2: Number(2n * nanosOfDay + dayLength) / Number(2n * dayLength),
  };
}
