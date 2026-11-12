/*
 * The METAR report-time group `YYGGggZ` (`251200Z`): a two-digit day of month, two digits of hour,
 * two digits of minute, all UTC, then the letter `Z` with no space. Private: a group names no
 * month or year, so it is an instant only against a reference; the public check is
 * `isValidMetarTime(value, referenceInstant)`, never a pattern.
 *
 * Sources:
 * - WMO-No. 306 (2011, updated 2013), Vol. I.1 Part A, FM 15 reg. 15.3.1: "The day of the month
 *   and the time of observation in hours and minutes UTC followed, without a space, by the letter
 *   indicator Z shall be included in each individual METAR report"; reg. 15.3.2 says the same
 *   for SPECI.
 * - FM 51 reg. 51.1.2: a TAF's issue time is the same group (`YYGGggZ`).
 * - Symbolic letters `YY` ("Day of the month (UTC), with 01 indicating the first day") and
 *   `GGggZ` ("in hours and minutes UTC, followed by the letter Z").
 * - ICAO Annex 3, Appendix 3 was not reached.
 *
 * GMT rules:
 * - Letters upper case only (`Z`, never `z`); digits ASCII only: the grammar writes `[0-9]`,
 *   not `\d`.
 * - The reader checks the shape, not the time: day `00` and `32`, hour `24` and minute `60` come
 *   back as fields, and the parser rejects them.
 */

/** The fields of a `YYGGggZ` group, as numbers: day 0–99, hour 0–99, minute 0–99 (shape only). */
export interface MetarTimeFields {
  day: number;
  hour: number;
  minute: number;
}

// No flags: `$` then fails before a trailing newline. Fixed-width classes, so linear time.
const METAR_TIME = /^([0-9]{2})([0-9]{2})([0-9]{2})Z$/;

/** Read the fields of a `YYGGggZ` group, or null when the shape does not match. */
export function readMetarTimeFields(value: string): MetarTimeFields | null {
  const match = METAR_TIME.exec(value);
  if (match === null) return null;
  const [, dd, hh, mm] = match as unknown as [string, string, string, string];
  return { day: Number(dd), hour: Number(hh), minute: Number(mm) };
}
