import {
  formatUtcReading,
  LEAP_SECOND_STEPS,
  parseTimeScaleString,
  utcOfTai,
} from "../../internal";

/**
 * Convert a TAI time-scale string to a UTC instant string.
 *
 * - Reads `YYYY-MM-DDTHH:MM:SS[.fraction] TAI`: four-digit year, `T`, seconds required, 1 to 9
 *   fraction digits after `.`, one space, `TAI` (the FITS time-scale token). TAI has no second 60.
 * - UTC = TAI − (TAI − UTC), from the IERS leap-second table built into GMT (Leap_Second.dat
 *   through Bulletin C 72, 6 July 2026). The table is closed: after the last insertion
 *   (2016-12-31) TAI − UTC stays 37 s.
 * - During an inserted leap second the result is `…T23:59:60Z` (ITU-R TF.460-6 Annex 3). Only this
 *   realm's functions read that string back; other GMT functions reject a second of 60.
 * - "" before 1972-01-01T00:00:10 TAI and on invalid input.
 *
 * @param taiString TAI time-scale string
 * @returns ISO 8601 UTC instant string (`Z`), or "" on invalid input or a date before 1972
 *
 * @example fromTAI("2026-01-01T00:00:37 TAI") // "2026-01-01T00:00:00Z"
 * @example fromTAI("2017-01-01T00:00:36 TAI") // "2016-12-31T23:59:60Z"
 * @example fromTAI("2017-01-01T00:00:36.5 TAI") // "2016-12-31T23:59:60.5Z"
 * @example fromTAI("2024-01-01T00:00:37 GPS") // "" — wrong token
 * @example fromTAI("2016-12-31T23:59:60 TAI") // "" — TAI has no leap seconds
 */
export function fromTAI(taiString: string): string {
  try {
    const label = parseTimeScaleString(taiString, "TAI");
    if (label === null || label.secondSixty) {
      return "";
    }
    const reading = utcOfTai(LEAP_SECOND_STEPS, label.labelNanoseconds);
    return reading === null ? "" : formatUtcReading(reading);
  } catch {
    return "";
  }
}
