/** TC39 Temporal `PadISOYear ( y )`, §3.5.10: a year from 0 to 9999 is written with four digits. */
const MAX_FOUR_DIGIT_YEAR = 9999;

/**
 * Write an ISO year as Temporal writes it at the head of a date string (TC39 Temporal
 * `PadISOYear ( y )`, §3.5.10): four digits from 0000 to 9999, otherwise a sign and six digits.
 *
 * A year written any other way does not read back. `"10000-01-01"` and `"00-5-01-01"` are not ISO
 * 8601 or Temporal strings, and `isValidDate` rejects both; `"+010000-01-01"` and
 * `"-000005-01-01"` are what `Temporal.PlainDate#toString` writes.
 *
 * - Every function that returns a year on its own writes it this way.
 * - Where a Temporal value is at hand, let its own `toString` write the whole date. This is for a
 *   year on its own, or a date assembled from fields with no Temporal value behind them.
 *
 * @param year an ISO year, an integer
 * @returns the year as `YYYY` or `±YYYYYY`
 *
 * @example isoYearString(2024) // "2024"
 * @example isoYearString(5) // "0005"
 * @example isoYearString(10000) // "+010000"
 * @example isoYearString(-5) // "-000005"
 */
export function isoYearString(year: number): string {
  return year < 0 || year > MAX_FOUR_DIGIT_YEAR
    ? `${year < 0 ? "-" : "+"}${String(Math.abs(year)).padStart(6, "0")}`
    : String(year).padStart(4, "0");
}
