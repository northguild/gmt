import { NANOSECONDS_PER_SECOND } from "./foreignEpochs";
import type { UtcReading } from "./utcReading";

/** TAI − UTC by date: `at[i]` (epoch ns, 00:00:00 UTC on a month's first day) starts `taiMinusUtc[i]`. */
export interface LeapSecondSteps {
  /** Epoch nanoseconds at which each row's TAI − UTC takes effect, strictly increasing. */
  readonly at: readonly bigint[];
  /** TAI − UTC in whole seconds from `at[i]` until `at[i + 1]`. */
  readonly taiMinusUtc: readonly bigint[];
}

// IERS Earth Orientation Center, Leap_Second.dat, "Updated through IERS Bulletin 72 issued in
// July 2026": one row per MJD with TAI − UTC from that date. Each bigint is
// `Temporal.Instant.from(<date>).epochNanoseconds` of the date in its comment;
// leapSeconds.test.ts asserts each one. The first row is where whole-second TAI − UTC begins
// (BIPM Annual Report on Time Activities vol. 15, Table 2: "1972 Jan. 1 … 10 (integral number of
// seconds)"); the 27 after it are the 27 inserted leap seconds (ITU-R TF.460-6 Annex 1 §2.2).
const ROWS: readonly (readonly [bigint, bigint])[] = [
  [63072000000000000n, 10n], // 1972-01-01T00:00:00Z
  [78796800000000000n, 11n], // 1972-07-01T00:00:00Z
  [94694400000000000n, 12n], // 1973-01-01T00:00:00Z
  [126230400000000000n, 13n], // 1974-01-01T00:00:00Z
  [157766400000000000n, 14n], // 1975-01-01T00:00:00Z
  [189302400000000000n, 15n], // 1976-01-01T00:00:00Z
  [220924800000000000n, 16n], // 1977-01-01T00:00:00Z
  [252460800000000000n, 17n], // 1978-01-01T00:00:00Z
  [283996800000000000n, 18n], // 1979-01-01T00:00:00Z
  [315532800000000000n, 19n], // 1980-01-01T00:00:00Z
  [362793600000000000n, 20n], // 1981-07-01T00:00:00Z
  [394329600000000000n, 21n], // 1982-07-01T00:00:00Z
  [425865600000000000n, 22n], // 1983-07-01T00:00:00Z
  [489024000000000000n, 23n], // 1985-07-01T00:00:00Z
  [567993600000000000n, 24n], // 1988-01-01T00:00:00Z
  [631152000000000000n, 25n], // 1990-01-01T00:00:00Z
  [662688000000000000n, 26n], // 1991-01-01T00:00:00Z
  [709948800000000000n, 27n], // 1992-07-01T00:00:00Z
  [741484800000000000n, 28n], // 1993-07-01T00:00:00Z
  [773020800000000000n, 29n], // 1994-07-01T00:00:00Z
  [820454400000000000n, 30n], // 1996-01-01T00:00:00Z
  [867715200000000000n, 31n], // 1997-07-01T00:00:00Z
  [915148800000000000n, 32n], // 1999-01-01T00:00:00Z
  [1136073600000000000n, 33n], // 2006-01-01T00:00:00Z
  [1230768000000000000n, 34n], // 2009-01-01T00:00:00Z
  [1341100800000000000n, 35n], // 2012-07-01T00:00:00Z
  [1435708800000000000n, 36n], // 2015-07-01T00:00:00Z
  [1483228800000000000n, 37n], // 2017-01-01T00:00:00Z
];

/**
 * IERS Earth Orientation Center, Leap_Second.dat (https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat),
 * updated through IERS Bulletin C 72, 6 July 2026. Closed: CGPM 2026 Resolution 5 makes UTC
 * continuous from 20 May 2027, and Bulletin C 72 rules out the end of December 2026. After the last
 * row TAI − UTC stays 37 s. Checked weekly against IERS by scripts/leap-seconds.mjs.
 */
export const LEAP_SECOND_STEPS: LeapSecondSteps = Object.freeze({
  at: Object.freeze(ROWS.map(([at]) => at)),
  taiMinusUtc: Object.freeze(ROWS.map(([, offset]) => offset)),
});

/** Index of the last row that starts at or before `u`, or −1 before the first row. */
function rowAt(steps: LeapSecondSteps, u: bigint): number {
  let found = -1;
  for (
    let index = 0;
    index < steps.at.length && steps.at[index] <= u;
    index += 1
  ) {
    found = index;
  }
  return found;
}

/** TAI − UTC of row `index`, in nanoseconds. */
function offsetOf(steps: LeapSecondSteps, index: number): bigint {
  return steps.taiMinusUtc[index] * NANOSECONDS_PER_SECOND;
}

/** The step from row `index − 1` to row `index`, in nanoseconds: `+S` inserts, `−S` deletes. */
function stepAt(steps: LeapSecondSteps, index: number): bigint {
  return offsetOf(steps, index) - offsetOf(steps, index - 1);
}

/**
 * TAI of a UTC reading, as label nanoseconds (the TAI wall clock read as if UTC), or `null` when
 * the reading has no TAI instant.
 *
 * - `null` before the first row: TAI − UTC was not a whole number of seconds before 1972 (BIPM
 *   Annual Report vol. 15, Table 2).
 * - A second-60 reading is valid only in the second before a positive step, where it maps to
 *   that inserted second: old offset + 1 s (ITU-R TF.460-6 Annex 1 §2.2).
 * - An ordinary reading inside a deleted second (before a negative step) has no instant.
 * - No upper bound: after the last row its offset holds.
 *
 * @param steps the leap-second table
 * @param reading the UTC reading
 * @returns TAI label nanoseconds, or null
 */
export function taiOfUtc(
  steps: LeapSecondSteps,
  reading: UtcReading,
): bigint | null {
  const u = reading.epochNanoseconds;
  if (u < steps.at[0]) {
    return null;
  }

  if (reading.secondSixty) {
    for (let index = 1; index < steps.at.length; index += 1) {
      if (
        steps.at[index] - NANOSECONDS_PER_SECOND <= u &&
        u < steps.at[index] &&
        stepAt(steps, index) === NANOSECONDS_PER_SECOND
      ) {
        return u + offsetOf(steps, index - 1) + NANOSECONDS_PER_SECOND;
      }
    }
    return null;
  }

  const index = rowAt(steps, u);
  const next = index + 1;
  if (
    next < steps.at.length &&
    stepAt(steps, next) === -NANOSECONDS_PER_SECOND &&
    u >= steps.at[next] - NANOSECONDS_PER_SECOND
  ) {
    return null;
  }
  return u + offsetOf(steps, index);
}

/**
 * The UTC reading of a TAI instant given as label nanoseconds, or `null` before the table's
 * first TAI instant (1972-01-01T00:00:10 TAI).
 *
 * - Inside an inserted second the reading is second 60: its `epochNanoseconds` is the
 *   `…T23:59:59.f` instant Temporal would clamp `…:60.f` to.
 * - A negative step needs no special case: the deleted second has no TAI instant to map.
 *
 * @param steps the leap-second table
 * @param tai TAI label nanoseconds
 * @returns the UTC reading, or null
 */
export function utcOfTai(
  steps: LeapSecondSteps,
  tai: bigint,
): UtcReading | null {
  let index = -1;
  for (
    let row = 0;
    row < steps.at.length && steps.at[row] + offsetOf(steps, row) <= tai;
    row += 1
  ) {
    index = row;
  }
  if (index === -1) {
    return null;
  }

  const u = tai - offsetOf(steps, index);
  if (index + 1 < steps.at.length && u >= steps.at[index + 1]) {
    return { epochNanoseconds: u - NANOSECONDS_PER_SECOND, secondSixty: true };
  }
  return { epochNanoseconds: u, secondSixty: false };
}

/**
 * The UTC reading of step `index`'s own second, the second before `at[index]` (ITU-R TF.460-6
 * Annex 1 §2.2): for a positive step the inserted `…T23:59:60` (a second-60 reading); for a
 * negative step the omitted `…T23:59:59` (an ordinary reading of its label).
 *
 * @param steps the leap-second table
 * @param index a row index from 1
 * @returns the reading of that step's second
 */
export function stepReading(steps: LeapSecondSteps, index: number): UtcReading {
  return {
    epochNanoseconds: steps.at[index] - NANOSECONDS_PER_SECOND,
    secondSixty: stepAt(steps, index) > 0n,
  };
}

/**
 * Index of the first step (row 1 on) that starts after a UTC reading, or −1 when there is none.
 * A second-60 reading counts as the instant one second later, so its own step is behind it.
 *
 * @param steps the leap-second table
 * @param reading the UTC reading
 * @returns the row index, or −1
 */
export function nextStepIndex(
  steps: LeapSecondSteps,
  reading: UtcReading,
): number {
  const u = reading.secondSixty
    ? reading.epochNanoseconds + NANOSECONDS_PER_SECOND
    : reading.epochNanoseconds;
  for (let index = 1; index < steps.at.length; index += 1) {
    if (steps.at[index] > u) {
      return index;
    }
  }
  return -1;
}
