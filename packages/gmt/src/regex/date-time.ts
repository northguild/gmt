/**
 * RegExp matching ISO 8601 local date-time (extended): `<date>T<time>`.
 *
 * - Date half: `YYYY-MM-DD` or `±YYYYYY-MM-DD` (6-digit year with sign, never `-000000`,
 *   which is a Syntax Error in Temporal's `DateYear`).
 * - Time half: `HH:mm` with optional `:ss[.fffffffff]` (fractional seconds use `.` or `,`).
 * - Second `60` does not match. Temporal's `TimeSecond` admits it, but GMT rejects leap
 *   seconds because Temporal would read one as `:59`. The 9-digit fraction cap is Temporal's
 *   nanosecond precision.
 * - No timezone designator — this is a plain/local date-time only.
 * - Shape-only validation; real calendar validation is delegated to
 *   `Temporal.PlainDateTime.from` in `isValidDateTime`.
 *
 * Capture groups: 1 month, 2 day, 3 hour. The year, minute, second and fraction are not
 * captured.
 *
 * The written form only, with no RFC 9557 annotation. `isValidDateTime` reads more: it matches this
 * against the part before the first `[` and lets Temporal read the annotations
 * (`"…[u-ca=iso8601]"`, an elective `"…[foo=bar]"`).
 *
 * @example plainDateTime.test("2024-03-15T14:30:00")       // true
 * @example plainDateTime.test("2024-03-15T14:30")          // true (seconds omitted)
 * @example plainDateTime.test("+000031-04-30T12:00:00.123") // true (6-digit year)
 * @example plainDateTime.exec("2024-03-15T14:30:45")?.slice(1) // ["03", "15", "14"] (month, day, hour)
 * @example plainDateTime.test("-000000-01-01T00:00")       // false (negative zero year)
 * @example plainDateTime.test("2024-03-15 14:30:00")       // false (space separator)
 * @example plainDateTime.test("2024-03-15T14:30:00Z")      // false (has timezone)
 */
export const plainDateTime: RegExp =
  /^(?:\d{4}|\+\d{6}|-(?!0{6})\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:[.,][0-9]{1,9})?)?$/;
