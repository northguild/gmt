import { floorDivide } from "./floorDivide";
import type { LeapSecondSteps } from "./leapSeconds";
import { taiOfUtc, utcOfTai } from "./leapSeconds";
import type { UtcReading } from "./utcReading";

/**
 * Terrestrial Time (TT) and Geocentric Coordinate Time (TCG) from the TAI hinge.
 *
 * Sources: IERS Conventions (2010), TN 36 §10.1 eq. (10.1); IAU 2000 Resolution B1.9. Pure bigint
 * nanoseconds: no Temporal call, nothing at import, no loop of its own. No Julian Date is
 * computed: eq. (10.1)'s `(JD_TT − T₀) × 86400` is TT nanoseconds since the TT label of
 * 1977-01-01T00:00:00 TAI.
 */

/** TT − TAI, exactly 32.184 s (IERS TN 36 §10.1, p. 151). */
export const TT_MINUS_TAI_NANOSECONDS = 32_184_000_000n;

/**
 * The TT label of 1977-01-01T00:00:00 TAI, where TCG and TT read the same:
 * 1977-01-01T00:00:32.184 as UTC-style epoch nanoseconds (TN 36 eq. 10.1; T₀ = 2443144.5003725
 * is this instant as a TT Julian Date).
 */
export const TCG_TT_EPOCH_NANOSECONDS = 220_924_832_184_000_000n;

/** L_G numerator: L_G = 6.969290134 × 10⁻¹⁰ (IAU 2000 B1.9) is `L_G_NUMERATOR / L_G_DENOMINATOR`. */
export const L_G_NUMERATOR = 6_969_290_134n;

/** L_G denominator, 10^19, so that `L_G_NUMERATOR / L_G_DENOMINATOR` is L_G exactly. */
export const L_G_DENOMINATOR = 10_000_000_000_000_000_000n;

/**
 * TT label nanoseconds of a UTC reading.
 *
 * @param steps the leap-second table
 * @param reading the UTC reading
 * @returns TT nanoseconds, or null where `taiOfUtc` is null
 */
export function ttOfUtc(
  steps: LeapSecondSteps,
  reading: UtcReading,
): bigint | null {
  const tai = taiOfUtc(steps, reading);
  return tai === null ? null : tai + TT_MINUS_TAI_NANOSECONDS;
}

/**
 * The UTC reading of a TT label.
 *
 * @param steps the leap-second table
 * @param tt TT label nanoseconds
 * @returns the UTC reading, or null before 1972-01-01T00:00:42.184 TT
 */
export function utcOfTt(steps: LeapSecondSteps, tt: bigint): UtcReading | null {
  return utcOfTai(steps, tt - TT_MINUS_TAI_NANOSECONDS);
}

/**
 * TCG − TT at a TT label, in nanoseconds, floored toward −∞: `d × L_G / (1 − L_G)` with `d` the TT
 * nanoseconds since the epoch (TN 36 eq. 10.1, exact rate).
 *
 * @param tt TT label nanoseconds
 * @returns the offset in nanoseconds
 */
export function tcgMinusTtNanoseconds(tt: bigint): bigint {
  return floorDivide(
    (tt - TCG_TT_EPOCH_NANOSECONDS) * L_G_NUMERATOR,
    L_G_DENOMINATOR - L_G_NUMERATOR,
  );
}

/**
 * The TT label of a TCG label: TT = TCG − L_G × (TCG − T₀), solved from dTT/dTCG = 1 − L_G (IAU
 * 2000 B1.9) with T₀ from IERS TN 36 eq. (10.1); the floor is GMT's nanosecond rule. Exact inverse of `tt + tcgMinusTtNanoseconds(tt)` for every TT nanosecond.
 *
 * @param tcg TCG label nanoseconds
 * @returns TT label nanoseconds
 */
export function ttOfTcg(tcg: bigint): bigint {
  return (
    tcg -
    floorDivide(
      (tcg - TCG_TT_EPOCH_NANOSECONDS) * L_G_NUMERATOR,
      L_G_DENOMINATOR,
    )
  );
}
