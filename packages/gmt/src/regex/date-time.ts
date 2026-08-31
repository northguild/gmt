/**
 * RegExp matching ISO 8601 local date-time (extended): `<date>T<time>`.
 *
 * - Date half: `YYYY-MM-DD` or `±YYYYYY-MM-DD` (6-digit year with sign).
 * - Time half: `HH:mm` with optional `:ss[.fffffffff]` (fractional seconds use `.` or `,`).
 * - No timezone designator — this is a plain/local date-time only.
 * - Shape-only validation; real calendar validation is delegated to
 *   `Temporal.PlainDateTime.from` in `parseDateTime`.
 *
 * Capture groups: 1 year, 2 month, 3 day, 4 hour, 5 minute, 6 second (optional),
 * 7 fractional (optional).
 *
 * @example plainDateTime.test("2024-03-15T14:30:00")       // true
 * @example plainDateTime.test("2024-03-15T14:30")          // true (seconds omitted)
 * @example plainDateTime.test("+000031-04-30T12:00:00.123") // true (6-digit year)
 * @example plainDateTime.test("2024-03-15 14:30:00")       // false (space separator)
 * @example plainDateTime.test("2024-03-15T14:30:00Z")      // false (has timezone)
 */
export const plainDateTime: RegExp =
  /^(?:\d{4}|[+-]\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:[.,][0-9]{1,9})?)?$/;
