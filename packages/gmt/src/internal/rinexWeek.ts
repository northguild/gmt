import type { GnssSystem, RinexWeekSystem } from "../types/gnss";

/** Where a RINEX navigation record's continuous week count starts. */
export interface RinexWeekEpoch {
  /** The satellite time scale the record's week and time of week are read on. */
  readonly system: GnssSystem;
  /** Week 0's first label on that scale, label nanoseconds. */
  readonly epochLabel: bigint;
}

/**
 * Epoch label of each RINEX navigation record's continuous week count (RINEX 4.02). The count
 * never wraps, so it has no modulus and no era. Each `epochLabel` is
 * `Temporal.PlainDateTime.from(<label>).toZonedDateTime("UTC").epochNanoseconds` of the label in
 * its comment; rinexWeek.test.ts asserts each one.
 */
export const RINEX_WEEK_EPOCHS: Readonly<
  Record<RinexWeekSystem, RinexWeekEpoch>
> = Object.freeze({
  // 1980-01-06T00:00:00 GPS: RINEX 4.02 Table A9; §4.1.8 Table 3, "GPS/QZS/IRN/GAL RINEX" row.
  GPS: Object.freeze({ system: "GPS", epochLabel: 315964800000000000n }),
  // 1980-01-06T00:00:00 GAL: RINEX 4.02 Table A13 footnote 5*; Table 3. Galileo time itself
  // starts 1999-08-22, so weeks before 1024 have no Galileo label.
  GAL: Object.freeze({ system: "GAL", epochLabel: 315964800000000000n }),
  // 2006-01-01T00:00:00 BDT: RINEX 4.02 §5.4.6 p. 41 and Table A23 p. 99, BDT weeks from the
  // BeiDou epoch; worked example in Table A27.
  BDT: Object.freeze({ system: "BDT", epochLabel: 1136073600000000000n }),
  // 1980-01-06T00:00:00 QZS: RINEX 4.02 Table A19; Table 3.
  QZS: Object.freeze({ system: "QZS", epochLabel: 315964800000000000n }),
  // 1980-01-06T00:00:00 IRN: RINEX 4.02 Table A30 p. 109, "Continuous number, not mod (1024),
  // counted from 1980 (same as GPS)". NavIC time itself starts 1999-08-22.
  IRN: Object.freeze({ system: "IRN", epochLabel: 315964800000000000n }),
});

/**
 * Whether a value names a system whose RINEX navigation records carry a week number.
 *
 * @param value candidate system
 * @returns true for `GPS`, `GAL`, `BDT`, `QZS` or `IRN`
 */
export function isRinexWeekSystem(value: unknown): value is RinexWeekSystem {
  return typeof value === "string" && Object.hasOwn(RINEX_WEEK_EPOCHS, value);
}
