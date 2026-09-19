/**
 * RegExp matching a SQL timestamp literal without a time zone: `YYYY-MM-DD HH:MM:SS[.fffffffff]`.
 *
 * The grammar is SQL-92 §5.3 `<timestamp string>` and the ODBC `ts` escape
 * (`yyyy-mm-dd hh:mm:ss[.f...]`):
 *
 * - `<date value> <space> <time value>`: a single space separator, never `T`.
 * - Syntax Rule 21: the year is four digits and every other field two digits, zero-padded. No
 *   sign and no expanded year.
 * - Table 10: YEAR `0001`–`9999`, MONTH `01`–`12`, DAY `01`–`31`, HOUR `00`–`23`, MINUTE
 *   `00`–`59`.
 * - Seconds are required (`<time value>` is `<hours value>:<minutes value>:<seconds value>`).
 * - `<seconds value> ::= <seconds integer value> [ <period> [ <seconds fraction> ] ]`: an optional
 *   `.` then up to 9 fraction digits. SQL-92 leaves the precision to the implementation; 9 is
 *   Temporal's nanosecond.
 * - SECOND `60`–`61` does not match, although Table 10 allows them: GMT rejects leap seconds
 *   because Temporal would read one as `:59`.
 * - Shape-only validation; the calendar date is checked by `Temporal.PlainDateTime.from` in
 *   `parseSql`.
 *
 * Capture groups: 1 month, 2 day, 3 hour. The year, minute, second and fraction are not
 * captured.
 *
 * @example sqlDateTime.test("2024-03-15 14:30:00.123456789") // true
 * @example sqlDateTime.test("0001-01-01 00:00:00")           // true (the first year SQL allows)
 * @example sqlDateTime.test("2024-03-15 14:30:00.")          // true (period with no fraction)
 * @example sqlDateTime.test("2024-03-15 14:30")              // false (seconds are required)
 * @example sqlDateTime.test("0000-01-01 00:00:00")           // false (year outside 0001–9999)
 * @example sqlDateTime.test("+002024-03-15 14:30:00")        // false (expanded year)
 * @example sqlDateTime.test("2024-03-15T14:30:00")           // false (T separator)
 * @example sqlDateTime.test("2024-3-5 14:30:00")             // false (unpadded)
 * @example sqlDateTime.test("2024-03-15 14:30:60")           // false (leap second; GMT rejects it)
 */
export const sqlDateTime: RegExp =
  /^(?!0000)\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]) (0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]{0,9})?$/;
