import {
  LEAP_SECOND_STEPS,
  parseUtcReading,
  tcgMinusTtNanoseconds,
  ttOfUtc,
} from "../../internal";

/**
 * Return TCG − TT, in seconds, at a UTC instant.
 *
 * - TCG − TT = (L_G / (1 − L_G)) × (TT − T₀), L_G = 6.969290134 × 10⁻¹⁰ (IAU 2000 B1.9),
 *   T₀ = 1977-01-01T00:00:32.184 TT (IERS TN 36 §10.1, eq. 10.1). Zero at T₀
 *   (`1976-12-31T23:59:45Z`), negative before it, growing about 22 ms a year.
 * - The value is the offset `toTCG` applies: computed exactly, floored to the nanosecond.
 * - A listed leap second (`…T23:59:60Z`) is accepted.
 * - `null` before 1972-01-01 (no integer TAI − UTC, so no TT), for a second-60 string on a day
 *   with no insertion, and on invalid input.
 *
 * @param isoString ISO 8601 instant string; a listed leap second (`…T23:59:60Z`) is accepted
 * @returns TCG − TT in seconds, or null on invalid input or a date before 1972
 *
 * @example tcgMinusTt("2026-01-01T00:00:00Z") // 1.077661917
 * @example tcgMinusTt("2000-01-01T12:00:00Z") // 0.50583333
 * @example tcgMinusTt("1976-12-31T23:59:45Z") // 0 — the epoch T₀
 * @example tcgMinusTt("2016-12-31T23:59:60Z") // 0.879736307 — the inserted second
 * @example tcgMinusTt("1971-12-31T23:59:59Z") // null — before 1972
 */
export function tcgMinusTt(isoString: string): number | null {
  try {
    const reading = parseUtcReading(isoString);
    if (reading === null) {
      return null;
    }
    const tt = ttOfUtc(LEAP_SECOND_STEPS, reading);
    if (tt === null) {
      return null;
    }
    return Number(tcgMinusTtNanoseconds(tt)) / 1e9;
  } catch {
    return null;
  }
}
