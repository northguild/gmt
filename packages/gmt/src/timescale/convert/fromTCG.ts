import {
  formatUtcReading,
  LEAP_SECOND_STEPS,
  parseTimeScaleString,
  ttOfTcg,
  utcOfTt,
} from "../../internal";

/**
 * Convert a Geocentric Coordinate Time string to a UTC instant string.
 *
 * - Reads `YYYY-MM-DDTHH:MM:SS[.fraction] TCG`: four-digit year, `T`, seconds required, 1 to 9
 *   fraction digits after `.`, one space, `TCG` (the FITS 4.0 time-scale token). TCG has no
 *   second 60.
 * - TT = TCG − L_G × (TCG − T₀), the inverse of IERS TN 36 eq. 10.1 solved from
 *   dTT/dTCG = 1 − L_G (IAU 2000 B1.9) with T₀ from eq. 10.1; the floor is GMT's nanosecond rule.
 *   Then UTC from TT as `fromTT` does.
 * - Exact inverse of `toTCG` to the nanosecond. About one TCG nanosecond in 1.4 × 10⁹ is never
 *   written by `toTCG`; it reads as the next nanosecond's UTC instant.
 * - During an inserted leap second the result is `…T23:59:60Z` (ITU-R TF.460-6 Annex 3). Only this
 *   realm's functions read that string back; other GMT functions reject a second of 60.
 * - "" before 1972-01-01T00:00:42.07398781 TCG and on invalid input.
 *
 * @param tcgString TCG time-scale string
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input or a date before 1972
 *
 * @example fromTCG("2026-01-01T00:01:10.261661917 TCG") // "2026-01-01T00:00:00Z"
 * @example fromTCG("2017-01-01T00:01:09.063736307 TCG") // "2016-12-31T23:59:60Z"
 * @example fromTCG("1977-01-01T00:00:32.184 TCG") // "1976-12-31T23:59:45Z"
 * @example fromTCG("1972-01-01T00:00:42.073987809 TCG") // "" — before 1972
 * @example fromTCG("2026-01-01T00:01:10.261661917 TT") // "" — wrong token
 */
export function fromTCG(tcgString: string): string {
  try {
    const label = parseTimeScaleString(tcgString, "TCG");
    if (label === null) {
      return "";
    }
    const reading = utcOfTt(LEAP_SECOND_STEPS, ttOfTcg(label.labelNanoseconds));
    return reading === null ? "" : formatUtcReading(reading);
  } catch {
    return "";
  }
}
