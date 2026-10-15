import {
  formatTimeScaleString,
  LEAP_SECOND_STEPS,
  parseUtcReading,
  taiOfUtc,
} from "../../internal";

/**
 * Convert a UTC instant to a TAI time-scale string, `YYYY-MM-DDTHH:MM:SS[.fraction] TAI`.
 *
 * - TAI = UTC + (TAI − UTC), from the IERS leap-second table built into GMT (Leap_Second.dat
 *   through Bulletin C 72, 6 July 2026). The table is closed: the CGPM decided in 2026 that UTC
 *   becomes continuous on 20 May 2027, so after the last insertion (2016-12-31) TAI − UTC stays
 *   37 s.
 * - An inserted leap second maps to its own TAI second: `2016-12-31T23:59:60Z` is
 *   `2017-01-01T00:00:36 TAI`. A second 60 on any other day returns "".
 * - Accepts any offset or bracketed zone `toNanoseconds` accepts; TAI has no zone.
 * - `TAI` is the FITS time-scale token. No other GMT function reads the string; `fromTAI` does.
 * - "" before 1972-01-01, for a result past year 9999, and on invalid input.
 *
 * @param isoString ISO 8601 instant string
 * @returns the TAI time-scale string, or "" on invalid input or a date before 1972
 *
 * @example toTAI("2026-01-01T00:00:00Z") // "2026-01-01T00:00:37 TAI"
 * @example toTAI("2013-06-01T00:00:00Z") // "2013-06-01T00:00:35 TAI"
 * @example toTAI("2016-12-31T23:59:60.5Z") // "2017-01-01T00:00:36.5 TAI"
 * @example toTAI("2017-12-31T23:59:60Z") // "" — no leap second that day
 * @example toTAI("1971-12-31T00:00:00Z") // ""
 */
export function toTAI(isoString: string): string {
  try {
    const reading = parseUtcReading(isoString);
    if (reading === null) {
      return "";
    }
    const tai = taiOfUtc(LEAP_SECOND_STEPS, reading);
    if (tai === null) {
      return "";
    }
    return formatTimeScaleString(
      { labelNanoseconds: tai, secondSixty: false },
      "TAI",
    );
  } catch {
    return "";
  }
}
