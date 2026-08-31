/**
 * RegExp matching an ISO 8601 hour in extended format: `00`–`23`.
 *
 * @example hour.test("00") // true
 * @example hour.test("12") // true
 * @example hour.test("23") // true
 * @example hour.test("24") // false (out of range)
 * @example hour.test("9")  // false (not zero-padded)
 */
export const hour: RegExp = /^(0[0-9]|1[0-9]|2[0-3])$/;

/**
 * RegExp matching an ISO 8601 minute: `00`–`59`.
 *
 * @example minute.test("00") // true
 * @example minute.test("30") // true
 * @example minute.test("59") // true
 * @example minute.test("60") // false (out of range)
 */
export const minute: RegExp = /^[0-5][0-9]$/;

/**
 * RegExp matching an ISO 8601 second: `00`–`59`.
 *
 * @example second.test("00") // true
 * @example second.test("30") // true
 * @example second.test("59") // true
 * @example second.test("60") // false (out of range; leap seconds use a different pattern)
 */
export const second: RegExp = /^[0-5][0-9]$/;

/**
 * RegExp matching 1–9 fractional-second digits (nanosecond precision).
 *
 * - Used for the fractional portion after `.` or `,` in time strings.
 * - Backward-compatible alias `millisecond` points to this same pattern.
 *
 * @example fractionalSecond.test("123")       // true (milliseconds)
 * @example fractionalSecond.test("123456789") // true (nanoseconds)
 * @example fractionalSecond.test("0")         // false (must be 1–9 digits)
 * @example fractionalSecond.test("")          // false (empty)
 */
export const fractionalSecond: RegExp = /^[0-9]{1,9}$/;

/**
 * Backward-compatible alias for `fractionalSecond`. Prefer `fractionalSecond` for new
 * usage — the pattern matches 1–9 digits of fractional seconds, not just milliseconds.
 */
export const millisecond: RegExp = fractionalSecond;

/**
 * RegExp matching ISO 8601 local time (extended): `HH:mm[:ss[.fffffffff]]`.
 *
 * - Hours: `00`–`23`, zero-padded.
 * - Minutes and seconds: `00`–`59`, zero-padded.
 * - Seconds are optional; fractional seconds use `.` or `,` followed by 1–9 digits.
 * - No timezone designator — this is a plain/local time only.
 * - Shape-only validation; real field validation is delegated to
 *   `Temporal.PlainTime.from` in `parseTime`.
 *
 * Capture groups: 1 hour, 2 minute, 3 second (optional), 4 fractional (optional).
 *
 * @example plainTime.test("14:30")              // true
 * @example plainTime.test("14:30:00")           // true
 * @example plainTime.test("14:30:00.123")       // true (fractional seconds)
 * @example plainTime.test("14:30:00,123")       // true (comma separator)
 * @example plainTime.test("24:00:00")           // false (hour out of range)
 * @example plainTime.test("14:30:60")           // false (second out of range)
 */
export const plainTime: RegExp =
  /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:[.,][0-9]{1,9})?)?$/;
