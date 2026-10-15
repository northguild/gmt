import type { GnssSystem } from "../types/gnss";
import { NANOSECONDS_PER_SECOND } from "./foreignEpochs";
import { LEAP_SECOND_STEPS, taiOfUtc, utcOfTai } from "./leapSeconds";
import type { TimeScaleLabel } from "./timeScaleString";
import type { UtcReading } from "./utcReading";

/** How one satellite system's time scale relates to TAI, and where its labels start. */
export interface GnssTimeScale {
  /** TAI minus the scale, in seconds; null for GLO, which is UTC's own wall clock. */
  readonly taiMinusScale: bigint | null;
  /** First defined label, label nanoseconds. */
  readonly epochLabel: bigint;
}

/**
 * The satellite time scales by RINEX 4.02 §5.2.8 time-system identifier. Each `epochLabel` is
 * `Temporal.PlainDateTime.from(<label>).toZonedDateTime("UTC").epochNanoseconds` of the label in
 * its comment; gnssTimeScales.test.ts asserts each one. The offsets are nominal: the broadcast
 * corrections (C0, A0/A1, GGTO), tens of nanoseconds, are not inputs.
 */
export const GNSS_TIME_SCALES: Readonly<Record<GnssSystem, GnssTimeScale>> =
  Object.freeze({
    // TAI − GPS = 19 s: BIPM Annual Report vol. 15, p. 48, "[TAI - GPS time] = 19 s + C0".
    // Epoch 1980-01-06T00:00:00: IS-GPS-200N §3.3.4, "midnight on the night of January 5,
    // 1980/morning of January 6, 1980".
    GPS: Object.freeze({
      taiMinusScale: 19n,
      epochLabel: 315964800000000000n,
    }),
    // TAI − GST = 19 s: BIPM utc-gnss "[UTC-GALILEO time]: (19-xx) s"; RINEX 4.02 §4.1.7 Table 1,
    // "GPS = GAL = UTC + ΔtLS". Epoch 1999-08-22T00:00:00 GST, GPS week 1024 (RINEX 4.02 §4.1.3),
    // 13 s before 1999-08-22T00:00:00 UTC: Galileo OS SIS ICD Issue 2.2 §5.1.2, Table 69, "GST was
    // equal to 13 seconds on August 22nd, 1999 at 00:00:00 UTC".
    GAL: Object.freeze({
      taiMinusScale: 19n,
      epochLabel: 935280000000000000n,
    }),
    // TAI − BDT = 33 s: BIPM utc-gnss "[UTC-BEIDOU time]: (33-xx) s". Epoch 2006-01-01T00:00:00:
    // BDS-SIS-ICD-B1I-3.0 §3.3, "accumulates continuously without leap seconds. The start epoch
    // of BDT is 00:00:00 on January 1, 2006 of Coordinated Universal Time (UTC)".
    BDT: Object.freeze({
      taiMinusScale: 33n,
      epochLabel: 1136073600000000000n,
    }),
    // TAI − QZSST = 19 s, the same whole seconds as GPS time: RINEX 4.02 §4.1.7 Table 1, "GPS =
    // QZS = UTC + ΔtLS"; IS-QZSS-PNT-006 §5.1, "delayed from TAI by 19 seconds". Weeks from
    // GPST's 1980-01-06T00:00:00 (IS-QZSS-PNT-006 §5.1).
    QZS: Object.freeze({
      taiMinusScale: 19n,
      epochLabel: 315964800000000000n,
    }),
    // No TAI offset: GLO is GLONASS time in UTC hours, with UTC's leap seconds. RINEX 4.02
    // §4.1.2, "the same hours as UTC and not UTC+3 h"; §5.2.8, "GLO to identify the GLONASS UTC
    // time"; BIPM Annual Report vol. 15 p. 49, "[UTC - GLONASS time] = 0 s + C1". No stated
    // epoch, so labels start at 1972-01-01T00:00:00, the leap-second table's first row (owner
    // decision D10).
    GLO: Object.freeze({
      taiMinusScale: null,
      epochLabel: 63072000000000000n,
    }),
    // TAI − IRNSST = 19 s, DERIVED: BIPM publishes no NavIC row and no NavIC ICD mentions TAI.
    // RINEX 4.02 §4.1.7 Table 1 gives "GPS = IRN = UTC + ΔtLS"; the NavIC epoch gives the same:
    // NavIC led UTC by 13 s there (RINEX 4.02 §4.1.6; ISRO-IRNSS-ICD-SPS-1.1 §5.7;
    // ISRO-NAVIC-ICD-SPS-L1-1.0 §5.6) when TAI − UTC was 32 s (IERS), so 32 − 13. Epoch
    // 1999-08-22T00:00:00 IRNSST = 1999-08-21T23:59:47Z (RINEX 4.02 §4.1.6; ICD SPS 1.1 §5.7).
    IRN: Object.freeze({
      taiMinusScale: 19n,
      epochLabel: 935280000000000000n,
    }),
  });

/**
 * Whether a value is one of the six RINEX 4.02 §5.2.8 time-system identifiers GMT reads.
 *
 * @param value candidate system
 * @returns true for `GPS`, `GAL`, `BDT`, `QZS`, `GLO` or `IRN`
 */
export function isGnssSystem(value: unknown): value is GnssSystem {
  return typeof value === "string" && Object.hasOwn(GNSS_TIME_SCALES, value);
}

/**
 * A UTC reading as a label on a satellite system's scale.
 *
 * - TAI-based scales: TAI from the leap-second table, minus the scale's fixed offset. A listed
 *   inserted second maps to its own label; the result is never second 60.
 * - `GLO`: the reading itself, second 60 included, once the table has checked it.
 * - `null` when the reading has no TAI instant (before 1972, or a second 60 on a day with no
 *   insertion), or when the label falls before the scale's epoch.
 *
 * @param system the satellite time scale
 * @param reading the UTC reading
 * @returns the scale's label, or null
 */
export function scaleLabelOfUtc(
  system: GnssSystem,
  reading: UtcReading,
): TimeScaleLabel | null {
  const scale = GNSS_TIME_SCALES[system];
  const tai = taiOfUtc(LEAP_SECOND_STEPS, reading);
  if (tai === null) {
    return null;
  }
  const label: TimeScaleLabel =
    scale.taiMinusScale === null
      ? {
          labelNanoseconds: reading.epochNanoseconds,
          secondSixty: reading.secondSixty,
        }
      : {
          labelNanoseconds: tai - scale.taiMinusScale * NANOSECONDS_PER_SECOND,
          secondSixty: false,
        };
  return label.labelNanoseconds < scale.epochLabel ? null : label;
}

/**
 * A label on a satellite system's scale as a UTC reading.
 *
 * - TAI-based scales: the label plus the scale's fixed offset is TAI, read back through the
 *   leap-second table; inside an inserted second the reading is second 60.
 * - `GLO`: the label itself is the UTC reading; a second 60 stands only where the table lists an
 *   insertion.
 * - `null` before the scale's epoch, for a second-60 label on a continuous scale, and for a `GLO`
 *   second 60 on a day with no insertion.
 *
 * @param system the satellite time scale
 * @param label the scale's label
 * @returns the UTC reading, or null
 */
export function utcOfScaleLabel(
  system: GnssSystem,
  label: TimeScaleLabel,
): UtcReading | null {
  const scale = GNSS_TIME_SCALES[system];
  if (label.labelNanoseconds < scale.epochLabel) {
    return null;
  }
  if (scale.taiMinusScale === null) {
    const reading: UtcReading = {
      epochNanoseconds: label.labelNanoseconds,
      secondSixty: label.secondSixty,
    };
    return taiOfUtc(LEAP_SECOND_STEPS, reading) === null ? null : reading;
  }
  if (label.secondSixty) {
    return null;
  }
  return utcOfTai(
    LEAP_SECOND_STEPS,
    label.labelNanoseconds + scale.taiMinusScale * NANOSECONDS_PER_SECOND,
  );
}
