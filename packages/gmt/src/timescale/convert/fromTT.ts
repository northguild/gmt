import {
  formatUtcReading,
  LEAP_SECOND_STEPS,
  parseTimeScaleString,
  utcOfTt,
} from "../../internal";

/**
 * Convert a Terrestrial Time string to a UTC instant string.
 *
 * - Reads `YYYY-MM-DDTHH:MM:SS[.fraction] TT`: four-digit year, `T`, seconds required, 1 to 9
 *   fraction digits after `.`, one space, `TT` (the FITS 4.0 time-scale token). FITS's deprecated
 *   `TDT` and `ET` are not read. TT has no second 60.
 * - UTC = TT − 32.184 s − (TAI − UTC), from the IERS leap-second table built into GMT
 *   (Leap_Second.dat through Bulletin C 72, 6 July 2026). The table is closed: after the last
 *   insertion (2016-12-31) TAI − UTC stays 37 s.
 * - During an inserted leap second the result is `…T23:59:60Z` (ITU-R TF.460-6 Annex 3). Only this
 *   realm's functions read that string back; other GMT functions reject a second of 60.
 * - "" before 1972-01-01T00:00:42.184 TT and on invalid input.
 *
 * @param ttString TT time-scale string
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input or a date before 1972
 *
 * @example fromTT("2026-01-01T00:01:09.184 TT") // "2026-01-01T00:00:00Z"
 * @example fromTT("2017-01-01T00:01:08.184 TT") // "2016-12-31T23:59:60Z"
 * @example fromTT("2017-01-01T00:01:08.684 TT") // "2016-12-31T23:59:60.5Z"
 * @example fromTT("2026-01-01T00:01:09.184 TAI") // "" — wrong token
 * @example fromTT("2016-12-31T23:59:60 TT") // "" — TT has no second 60
 */
export function fromTT(ttString: string): string {
  try {
    const label = parseTimeScaleString(ttString, "TT");
    if (label === null) {
      return "";
    }
    const reading = utcOfTt(LEAP_SECOND_STEPS, label.labelNanoseconds);
    return reading === null ? "" : formatUtcReading(reading);
  } catch {
    return "";
  }
}
