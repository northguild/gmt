/**
 * RegExp matching ISO 8601 UTC datetime: `<date>T<time>Z` with optional fractional
 * seconds. The timezone designator accepts `Z` or `z` (lowercase is accepted for
 * leniency, though GMT's own formatter always emits uppercase).
 *
 * - Date half: `YYYY-MM-DD` or `±YYYYYY-MM-DD` (6-digit year with sign).
 * - Time half: `HH:mm` with optional `:ss[.fffffffff]` (fractional seconds use `.` or `,`).
 * - No numeric offset — only the `Z`/`z` UTC designator is accepted.
 * - Shape-only validation; real calendar validation is delegated to
 *   `Temporal.PlainDateTime.from` in `parseUtcDateTime`.
 *
 * Capture groups: 1 year, 2 month, 3 day, 4 hour, 5 minute, 6 second (optional),
 * 7 fractional (optional).
 *
 * @example utcDateTime.test("2024-03-15T14:30:00Z")       // true
 * @example utcDateTime.test("2024-03-15T14:30z")          // true (lowercase z)
 * @example utcDateTime.test("2024-03-15T14:30:00.123Z")   // true (fractional seconds)
 * @example utcDateTime.test("2024-03-15T14:30:00+00:00")  // false (numeric offset)
 * @example utcDateTime.test("2024-03-15T14:30:00")        // false (no timezone)
 */
export const utcDateTime: RegExp =
  /^(?:\d{4}|[+-]\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:[.,]\d{1,9})?)?[Zz]$/;
