import {
  formatTimeScaleString,
  LEAP_SECOND_STEPS,
  parseUtcReading,
  tcgMinusTtNanoseconds,
  ttOfUtc,
} from "../../internal";

/**
 * Convert a UTC instant to a Geocentric Coordinate Time string,
 * `YYYY-MM-DDTHH:MM:SS[.fraction] TCG`.
 *
 * - TCG = TT + (L_G / (1 − L_G)) × (TT − T₀), with L_G = 6.969290134 × 10⁻¹⁰ (IAU 2000 B1.9) and
 *   T₀ = 1977-01-01T00:00:32.184 TT, where the two coincide (IERS TN 36 §10.1, eq. 10.1). TT is
 *   TAI + 32.184 s, TAI from the built-in leap-second table.
 * - TCG runs ahead of TT by about 22 ms a year: about 1.08 s at the start of 2026, and TCG is
 *   behind TT before 1977. `tcgMinusTt` returns the gap.
 * - The rate term is computed exactly and floored to the nanosecond (GMT's nanosecond rule), so
 *   the result is the nanosecond at or before the true TCG.
 * - An inserted leap second maps to its own TCG instant: `2016-12-31T23:59:60Z` is
 *   `2017-01-01T00:01:09.063736307 TCG`. A second 60 on any other day returns "".
 * - Accepts any offset or bracketed zone; TCG has no zone. `TCG` is the FITS 4.0 time-scale token.
 * - "" before 1972-01-01, for a result past year 9999, and on invalid input.
 *
 * @param isoString ISO 8601 instant string
 * @returns the TCG time-scale string, or "" on invalid input, a date before 1972, or a TCG result past year 9999
 *
 * @example toTCG("2026-01-01T00:00:00Z") // "2026-01-01T00:01:10.261661917 TCG"
 * @example toTCG("2000-01-01T12:00:00Z") // "2000-01-01T12:01:04.68983333 TCG"
 * @example toTCG("1976-12-31T23:59:45Z") // "1977-01-01T00:00:32.184 TCG" — the epoch, TCG = TT
 * @example toTCG("2016-12-31T23:59:60Z") // "2017-01-01T00:01:09.063736307 TCG"
 * @example toTCG("2017-12-31T23:59:60Z") // "" — no leap second that day
 * @example toTCG("1971-12-31T23:59:59Z") // ""
 */
export function toTCG(isoString: string): string {
  try {
    const reading = parseUtcReading(isoString);
    if (reading === null) {
      return "";
    }
    const tt = ttOfUtc(LEAP_SECOND_STEPS, reading);
    if (tt === null) {
      return "";
    }
    return formatTimeScaleString(
      {
        labelNanoseconds: tt + tcgMinusTtNanoseconds(tt),
        secondSixty: false,
      },
      "TCG",
    );
  } catch {
    return "";
  }
}
