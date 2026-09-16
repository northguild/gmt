/**
 * RegExp matching ISO 8601 UTC datetime: `<date>T<time>Z` with optional fractional
 * seconds. The timezone designator accepts `Z` or `z` (lowercase is accepted for
 * leniency, though GMT's own formatter always emits uppercase).
 *
 * - Date half: `YYYY-MM-DD` or `±YYYYYY-MM-DD` (6-digit year with sign, never `-000000`,
 *   which is a Syntax Error in Temporal's `DateYear`).
 * - Time half: `HH:mm` with optional `:ss[.fffffffff]` (fractional seconds use `.` or `,`).
 * - Second `60` does not match. Temporal's `TimeSecond` admits it, but GMT rejects leap
 *   seconds because Temporal would read one as `:59`.
 * - No numeric offset — only the `Z`/`z` UTC designator is accepted.
 * - Shape-only validation; real validation is delegated to `Temporal.Instant.from` in
 *   `isValidUtc`.
 *
 * Capture groups: 1 month, 2 day, 3 hour. The year, minute, second and fraction are not
 * captured.
 *
 * @example utcDateTime.test("2024-03-15T14:30:00Z")       // true
 * @example utcDateTime.test("2024-03-15T14:30z")          // true (lowercase z)
 * @example utcDateTime.test("2024-03-15T14:30:00.123Z")   // true (fractional seconds)
 * @example utcDateTime.exec("2024-03-15T14:30:45.5Z")?.slice(1) // ["03", "15", "14"] (month, day, hour)
 * @example utcDateTime.test("-000000-01-01T00:00Z")       // false (negative zero year)
 * @example utcDateTime.test("2024-03-15T14:30:00+00:00")  // false (numeric offset)
 * @example utcDateTime.test("2024-03-15T14:30:00")        // false (no timezone)
 */
export const utcDateTime: RegExp =
  /^(?:\d{4}|\+\d{6}|-(?!0{6})\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:[.,]\d{1,9})?)?[Zz]$/;
