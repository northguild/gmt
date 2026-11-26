import {
  formatTimeScaleString,
  LEAP_SECOND_STEPS,
  parseUtcReading,
  ttOfUtc,
} from "../../internal";

/**
 * Convert a UTC instant to a Terrestrial Time string, `YYYY-MM-DDTHH:MM:SS[.fraction] TT`.
 *
 * - TT = TAI + 32.184 s exactly (IERS Conventions 2010, TN 36 §10.1), and TAI from the IERS
 *   leap-second table built into GMT (Leap_Second.dat through Bulletin C 72, 6 July 2026). The
 *   table is closed: the CGPM decided in 2026 that UTC becomes continuous on 20 May 2027, so after
 *   the last insertion (2016-12-31) TAI − UTC stays 37 s. So TT − UTC is 69.184 s from 2017 on.
 * - TT is the geocentric scale of Earth-based ephemerides. Barycentric work (planetary
 *   ephemerides) needs TDB, which differs from TT by up to about 1.7 ms; this function does not
 *   give it.
 * - An inserted leap second maps to its own TT second: `2016-12-31T23:59:60Z` is
 *   `2017-01-01T00:01:08.184 TT`. A second 60 on any other day returns "".
 * - Accepts any offset or bracketed zone; TT has no zone. `TT` is the FITS 4.0 time-scale token.
 * - "" before 1972-01-01, for a result past year 9999, and on invalid input.
 *
 * @param isoString ISO 8601 instant string
 * @returns the TT time-scale string, or "" on invalid input, a date before 1972, or a TT result past year 9999
 *
 * @example toTT("2026-01-01T00:00:00Z") // "2026-01-01T00:01:09.184 TT"
 * @example toTT("2013-06-01T00:00:00Z") // "2013-06-01T00:01:07.184 TT"
 * @example toTT("2016-12-31T23:59:60Z") // "2017-01-01T00:01:08.184 TT"
 * @example toTT("2017-12-31T23:59:60Z") // "" — no leap second that day
 * @example toTT("1971-12-31T23:59:59Z") // ""
 */
export function toTT(isoString: string): string {
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
      { labelNanoseconds: tt, secondSixty: false },
      "TT",
    );
  } catch {
    return "";
  }
}
