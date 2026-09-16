/**
 * RegExp matching a SQL timestamp literal in GMT's accepted shape:
 * `YYYY-MM-DD HH:mm[:ss[.fffffffff]]`.
 *
 * - Uses a space separator (never `T`), always zero-padded.
 * - Fractional seconds use `.` only (not `,`) and support 1–9 digits.
 * - Looser than the grammars it is named after, on purpose (the pattern is unchanged):
 *   - Seconds are optional. SQL-92 (`<time value>`, §5.3) and the ODBC `ts` escape
 *     (`yyyy-mm-dd hh:mm:ss[.f...]`) both require them.
 *   - The year may be `0000` or an ISO 8601 expanded `±YYYYYY` year. SQL-92 limits YEAR to
 *     `0001`–`9999` (Table 10). `-000000` never matches (a Syntax Error in Temporal's
 *     `DateYear`).
 * - Stricter in one place: second `60` does not match. SQL-92 allows SECOND `00` to `61.9(N)`,
 *   but GMT rejects leap seconds because Temporal would read one as `:59`.
 * - Shape-only validation; real calendar validation is delegated to
 *   `Temporal.PlainDateTime.from` in `parseSql`.
 *
 * Capture groups: 1 month, 2 day, 3 hour. The year, minute, second and fraction are not
 * captured.
 *
 * @example sqlDateTime.test("2024-03-15 14:30:00.123456789") // true
 * @example sqlDateTime.test("2024-03-15 14:30")               // true (seconds omitted; SQL-92 requires them)
 * @example sqlDateTime.test("+002024-03-15 14:30:00")         // true (expanded year; SQL-92 allows 0001–9999)
 * @example sqlDateTime.test("2024-03-15T14:30:00")            // false (T separator)
 * @example sqlDateTime.test("2024-3-5 14:30:00")             // false (unpadded)
 * @example sqlDateTime.test("2024-03-15 14:30:60")           // false (leap second; GMT rejects it)
 * @example sqlDateTime.test("-000000-01-01 00:00:00")        // false (negative zero year)
 */
export const sqlDateTime: RegExp =
  /^(?:\d{4}|\+\d{6}|-(?!0{6})\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]) (0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]{1,9})?)?$/;
