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
 * RegExp matching a second of `00`–`59`.
 *
 * - Temporal's `TimeSecond` and RFC 3339's `time-second` both admit `60` (a leap second). GMT
 *   rejects it by decision, because Temporal would read it as `:59`; `leapSecond` detects one.
 *
 * @example second.test("00") // true
 * @example second.test("30") // true
 * @example second.test("59") // true
 * @example second.test("60") // false (a leap second; GMT rejects it, see `leapSecond`)
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
 * @example fractionalSecond.test("1234567890") // false (more than 9 digits)
 * @example fractionalSecond.test("")          // false (empty)
 */
export const fractionalSecond: RegExp = /^[0-9]{1,9}$/;

/**
 * Backward-compatible alias for `fractionalSecond`. Prefer `fractionalSecond` for new
 * usage — the pattern matches 1–9 digits of fractional seconds, not just milliseconds.
 *
 * @example millisecond.test("123")        // true
 * @example millisecond.test("123456789")  // true (nanoseconds, despite the name)
 * @example millisecond.test("1234567890") // false (more than 9 digits)
 */
export const millisecond: RegExp = fractionalSecond;

/**
 * RegExp matching ISO 8601 local time (extended): `HH:mm[:ss[.fffffffff]]`.
 *
 * - Hours: `00`–`23`, zero-padded.
 * - Minutes and seconds: `00`–`59`, zero-padded.
 * - Seconds are optional; fractional seconds use `.` or `,` followed by 1–9 digits.
 * - No timezone designator — this is a plain/local time only.
 * - Second `60` does not match: GMT rejects leap seconds (Temporal's `TimeSecond` admits one
 *   and would read it as `:59`).
 * - Shape-only validation; real field validation is delegated to
 *   `Temporal.PlainTime.from` in `isValidTime`.
 *
 * Capture groups: 1 hour. The minute, second and fraction are not captured.
 *
 * The written form only, with no RFC 9557 annotation. `isValidTime` reads more: it matches this
 * against the part before the first `[` and lets Temporal read the annotations
 * (`"…[u-ca=iso8601]"`, an elective `"…[foo=bar]"`).
 *
 * @example plainTime.test("14:30")              // true
 * @example plainTime.test("14:30:00")           // true
 * @example plainTime.test("14:30:00.123")       // true (fractional seconds)
 * @example plainTime.test("14:30:00,123")       // true (comma separator)
 * @example plainTime.test("24:00:00")           // false (hour out of range)
 * @example plainTime.exec("14:30:45.5")?.slice(1) // ["14"] (hour)
 * @example plainTime.test("14:30:60")           // false (leap second; GMT rejects it)
 */
export const plainTime: RegExp =
  /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:[.,][0-9]{1,9})?)?$/;
