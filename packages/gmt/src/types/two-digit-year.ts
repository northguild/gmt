/**
 * How a two-digit year (`yy` in a pattern, `YYMMDD` in an EDI value) gets its century.
 *
 * No standard says which century a two-digit year belongs to, so GMT holds no cut-off of its own:
 * the caller names the hundred-year window. A two-digit year is a legacy form; a four-digit year
 * is the one to ask a data source for.
 */
export interface TwoDigitYearOptions {
  /**
   * The hundred-year window a two-digit year falls in. A number is the first year of a fixed
   * window, an integer from 0 to 9900: `2000` reads `00`–`99` as 2000–2099; `1950` reads `50`–`99`
   * as 1950–1999 and `00`–`49` as 2000–2049. A fixed window gives the same answer in any year,
   * so it is the form for stored data, archives and anything re-processed later. `"rolling"` is
   * the hundred years around today: from 50 years before the current UTC calendar year to 49
   * years after it (in 2026, 1976–2075). It is the form for live messages and never needs
   * maintenance, but it gives a different answer for the same stored value as years pass. Any
   * other value returns the function's sentinel.
   *
   * @defaultValue None. A value with a two-digit year returns the sentinel: no standard says which
   * century it belongs to, so the caller states it.
   */
  yearWindow?: "rolling" | number;
}
