/**
 * RegExp matching a SQL timestamp literal with a time zone offset:
 * `YYYY-MM-DD HH:MM:SS[.fffffffff][ ]±HH[:MM[:SS]]`.
 *
 * The grammar is SQL-92 §5.3 `<timestamp string>` with its optional `<time zone interval>`:
 *
 * - `<date value> <space> <time value> [ <time zone interval> ]`: a single space separator,
 *   never `T`.
 * - `<time zone interval> ::= <sign> <hours value> <colon> <minutes value>`, written directly
 *   after the time.
 * - Syntax Rule 21: the year is four digits and every other field two digits, zero-padded.
 *   §6.1 Table 10 (General Rule 4 of `<data type>`): YEAR `0001`–`9999`, HOUR `00`–`23`,
 *   MINUTE `00`–`59`. Seconds are required.
 * - `<seconds value> ::= <seconds integer value> [ <period> [ <seconds fraction> ] ]`: an
 *   optional `.` then up to 9 fraction digits (Temporal's nanosecond).
 * - SECOND `60`–`61` does not match: GMT rejects leap seconds because Temporal would read one
 *   as `:59`.
 *
 * Two vendor deviations from SQL-92 are allowed:
 *
 * - PostgreSQL §8.5.2 "Date/Time Output" shows the offset as `hh`, else `hh:mm`, else
 *   `hh:mm:ss`, so an hour-only offset (`-08`) and an offset with seconds (`+00:19:32`) match.
 * - SQL Server `datetimeoffset` prints one space before the sign (`2007-05-08 12:35:29.1234567
 *   +12:15`, its "Default string literal formats (used for down-level client)" row), and so
 *   does Oracle under an ISO `NLS_TIMESTAMP_TZ_FORMAT` such as `YYYY-MM-DD HH24:MI:SS.FF TZH:TZM`,
 *   so a single optional space matches.
 *
 * Offset hours are `00`–`23`, a GMT rule: SQL-92 Syntax Rule 25 predates `+14:00`, and 24 or
 * more is outside Temporal's offset grammar. `Z`, `T`, a basic `±HHMM` offset, a bracket
 * annotation and trailing text do not match.
 *
 * Shape-only validation: this pattern also matches a day that does not exist, such as 30
 * February. To check that a string is a real SQL offset timestamp, use
 * `isValidSqlOffsetDateTime`.
 *
 * Capture groups: 1 date `YYYY-MM-DD`, 2 time `HH:MM:SS`, 3 fraction digits (`undefined` with
 * no `.`, `""` for a bare `.`), 4 sign, 5 offset hours, 6 offset minutes (or `undefined`), 7
 * offset seconds (or `undefined`).
 *
 * @example sqlOffsetDateTime.test("2024-03-15 14:30:00+00")                // true (PostgreSQL hour-only offset)
 * @example sqlOffsetDateTime.test("2024-03-15 14:30:00+05:30")             // true (SQL-92 form)
 * @example sqlOffsetDateTime.test("2007-05-08 12:35:29.1234567 +12:15")    // true (SQL Server, space before the offset)
 * @example sqlOffsetDateTime.test("1900-01-01 00:00:00+00:19:32")          // true (PostgreSQL offset with seconds)
 * @example sqlOffsetDateTime.test("2024-02-30 00:00:00+00")                // true (shape only; the date is not real)
 * @example sqlOffsetDateTime.test("2024-03-15T14:30:00+00:00")             // false (T separator)
 * @example sqlOffsetDateTime.test("2024-03-15 14:30:00Z")                  // false (Z)
 * @example sqlOffsetDateTime.test("2024-03-15 14:30:00")                   // false (no offset; use sqlDateTime)
 * @example sqlOffsetDateTime.test("2024-03-15 14:30:00+0530")              // false (basic offset)
 * @example sqlOffsetDateTime.test("2024-03-15 14:30:00+24:00")             // false (offset hour 24)
 * @example sqlOffsetDateTime.test("2024-03-15 14:30:60+00")                // false (leap second; GMT rejects it)
 */
export const sqlOffsetDateTime: RegExp =
  /^((?!0000)\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])) ((?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9])(?:\.([0-9]{0,9}))? ?([+-])([01][0-9]|2[0-3])(?::([0-5][0-9])(?::([0-5][0-9]))?)?$/;
