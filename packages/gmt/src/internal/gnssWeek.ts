import { Temporal } from "@js-temporal/polyfill";
import type { GnssSystem, GnssWeek, GnssWeekCounter } from "../types/gnss";
import { NANOSECONDS_PER_SECOND, NANOSECONDS_PER_WEEK } from "./foreignEpochs";
import { GNSS_TIME_SCALES, scaleLabelOfUtc } from "./gnssTimeScales";

/** The scale a week counter counts on, and after how many weeks it wraps. */
export interface GnssWeekCounterSpec {
  /** The satellite time scale whose epoch is week 0 of era 0. */
  readonly system: GnssSystem;
  /** The number of week values the counter can show: it wraps to 0 after `modulus − 1`. */
  readonly modulus: bigint;
}

/**
 * The broadcast week counters, each with exactly one width. GLONASS broadcasts no week number,
 * so it has none.
 */
export const GNSS_WEEK_COUNTERS: Readonly<
  Record<GnssWeekCounter, GnssWeekCounterSpec>
> = Object.freeze({
  // IS-GPS-200N §20.3.3.3.1.1: LNAV week, "a modulo 1024 binary representation".
  "GPS-LNAV": Object.freeze({ system: "GPS", modulus: 1024n }),
  // IS-GPS-200N §30.3.3.1.1.1: CNAV week, "a modulo-8192 binary representation".
  "GPS-CNAV": Object.freeze({ system: "GPS", modulus: 8192n }),
  // Galileo OS SIS ICD Issue 2.2 §5.1.2, Table 69: 12-bit week, "covers 4096 weeks".
  GAL: Object.freeze({ system: "GAL", modulus: 4096n }),
  // BDS-SIS-ICD-B1I-3.0 §5.2.4.4: 13-bit week number, "0 through 8191".
  BDT: Object.freeze({ system: "BDT", modulus: 8192n }),
  // IS-QZSS-PNT-006 §4.1.2.3(1): LNAV week modulo 1024.
  "QZS-LNAV": Object.freeze({ system: "QZS", modulus: 1024n }),
  // IS-QZSS-PNT-006 §4.2.2: CNAV week modulo 8192.
  "QZS-CNAV": Object.freeze({ system: "QZS", modulus: 8192n }),
  // ISRO-IRNSS-ICD-SPS-1.1 §5.7: L5/S week "coded on 10 bits … which covers 1024 weeks".
  "IRN-LNAV": Object.freeze({ system: "IRN", modulus: 1024n }),
  // ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6: L1 week "on 13 bits … which covers 8192 weeks".
  "IRN-L1NV": Object.freeze({ system: "IRN", modulus: 8192n }),
});

/**
 * Whether a value names one of the eight broadcast week counters.
 *
 * @param value candidate counter
 * @returns true for a `GnssWeekCounter` member
 */
export function isGnssWeekCounter(value: unknown): value is GnssWeekCounter {
  return typeof value === "string" && Object.hasOwn(GNSS_WEEK_COUNTERS, value);
}

/**
 * A week number as a bigint: any safe integer from 0. The caller checks a counter's modulus.
 *
 * @param week candidate week number
 * @returns the week, or null when it is not a safe integer ≥ 0
 */
export function weekNumber(week: unknown): bigint | null {
  return Number.isSafeInteger(week) && (week as number) >= 0
    ? BigInt(week as number)
    : null;
}

/** Nanoseconds in one second, as a `number`, for reading a seconds-of-week `number`. */
const NANOSECONDS_PER_SECOND_NUMBER = Number(NANOSECONDS_PER_SECOND);

/**
 * Seconds of week as nanoseconds, rounded to the nearest nanosecond (TC39 Temporal's resolution;
 * a GMT rule). Valid from 0 up to but not including one week, 604 800 s (IS-GPS-200N §3.3.4).
 *
 * @param timeOfWeekSeconds candidate seconds of week
 * @returns the time of week in nanoseconds, or null when it is not a finite number in range or
 *   rounds to a whole week
 */
export function timeOfWeekNanoseconds(
  timeOfWeekSeconds: unknown,
): bigint | null {
  if (
    typeof timeOfWeekSeconds !== "number" ||
    !Number.isFinite(timeOfWeekSeconds) ||
    timeOfWeekSeconds < 0
  ) {
    return null;
  }
  const nanoseconds = BigInt(
    Math.round(timeOfWeekSeconds * NANOSECONDS_PER_SECOND_NUMBER),
  );
  return nanoseconds < NANOSECONDS_PER_WEEK ? nanoseconds : null;
}

/**
 * The label `fullWeek` weeks and `timeOfWeek` nanoseconds after an epoch label.
 *
 * @param epochLabel week 0's first label, label nanoseconds
 * @param fullWeek weeks since the epoch, never wrapped
 * @param timeOfWeek nanoseconds into that week
 * @returns the label, label nanoseconds
 */
export function labelOfFullWeek(
  epochLabel: bigint,
  fullWeek: bigint,
  timeOfWeek: bigint,
): bigint {
  return epochLabel + fullWeek * NANOSECONDS_PER_WEEK + timeOfWeek;
}

/**
 * Split a label into whole weeks since an epoch label and seconds into the week. The seconds are
 * a `number`: the nearest double to the exact nanosecond count.
 *
 * @param epochLabel week 0's first label, label nanoseconds
 * @param labelNanoseconds the label to split
 * @returns the full week and seconds of week, or null before the epoch
 */
export function weeksSince(
  epochLabel: bigint,
  labelNanoseconds: bigint,
): { fullWeek: bigint; timeOfWeekSeconds: number } | null {
  const elapsed = labelNanoseconds - epochLabel;
  if (elapsed < 0n) {
    return null;
  }
  return {
    fullWeek: elapsed / NANOSECONDS_PER_WEEK,
    timeOfWeekSeconds:
      Number(elapsed % NANOSECONDS_PER_WEEK) / NANOSECONDS_PER_SECOND_NUMBER,
  };
}

/**
 * The era a week number belongs to.
 *
 * - An integer from 0 is the era itself.
 * - `"rolling"` reads `Temporal.Now.instant()` once and picks the era that puts the full week
 *   within half a counter period of the current one: `Fnow − M/2 < F ≤ Fnow + M/2`, clamped at
 *   era 0 (a GMT rule, after the rolling two-digit-year window). Call it inside `try`: the clock
 *   read can throw.
 *
 * @param counter the week counter
 * @param week the week number the counter shows
 * @param rolloverEra an integer era from 0, or "rolling"
 * @returns the era, or null for any other value or when the clock reads before the counter's epoch
 */
export function resolveRolloverEra(
  counter: GnssWeekCounter,
  week: bigint,
  rolloverEra: unknown,
): bigint | null {
  if (rolloverEra !== "rolling") {
    return weekNumber(rolloverEra);
  }
  const { system, modulus } = GNSS_WEEK_COUNTERS[counter];
  const now = scaleLabelOfUtc(system, {
    epochNanoseconds: Temporal.Now.instant().epochNanoseconds,
    secondSixty: false,
  });
  if (now === null) {
    return null;
  }
  const currentWeek =
    (now.labelNanoseconds - GNSS_TIME_SCALES[system].epochLabel) /
    NANOSECONDS_PER_WEEK;
  const numerator = currentWeek - week + modulus / 2n;
  return numerator < 0n ? 0n : numerator / modulus;
}

/**
 * The label of a week time on a counter: epoch + (era × modulus + week) weeks + time of week.
 *
 * @param counter the week counter
 * @param week the week number the counter shows
 * @param timeOfWeek nanoseconds into the week
 * @param era how many times the counter has wrapped
 * @returns the label on the counter's scale, label nanoseconds
 */
export function labelOfWeek(
  counter: GnssWeekCounter,
  week: bigint,
  timeOfWeek: bigint,
  era: bigint,
): bigint {
  const { system, modulus } = GNSS_WEEK_COUNTERS[counter];
  return labelOfFullWeek(
    GNSS_TIME_SCALES[system].epochLabel,
    era * modulus + week,
    timeOfWeek,
  );
}

/**
 * The week, time of week and era of a label on a counter's scale.
 *
 * @param counter the week counter
 * @param labelNanoseconds a label on the counter's scale
 * @returns a new `GnssWeek`, or null before the counter's epoch
 */
export function weekOfLabel(
  counter: GnssWeekCounter,
  labelNanoseconds: bigint,
): GnssWeek | null {
  const { system, modulus } = GNSS_WEEK_COUNTERS[counter];
  const split = weeksSince(
    GNSS_TIME_SCALES[system].epochLabel,
    labelNanoseconds,
  );
  if (split === null) {
    return null;
  }
  return {
    week: Number(split.fullWeek % modulus),
    timeOfWeekSeconds: split.timeOfWeekSeconds,
    era: Number(split.fullWeek / modulus),
  };
}
