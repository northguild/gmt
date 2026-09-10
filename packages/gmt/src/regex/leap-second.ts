/**
 * RegExp fragment matching an ISO 8601 leap second: `T HH:mm:60[.fff]` followed by
 * a timezone designator (`Z`, numeric offset, or `[` opening a bracketed annotation).
 *
 * - Detects second = 60 within a date-time string, not a full standalone value.
 * - Used to identify and reject (or flag) leap-second values before Temporal parsing.
 *
 * @example leapSecond.test("2024-12-31T23:59:60Z")          // true
 * @example leapSecond.test("2024-12-31T23:59:60.123+00:00") // true
 * @example leapSecond.test("2024-12-31T23:59:59Z")          // false (second = 59)
 * @example leapSecond.test("2024-12-31T23:59:60")           // false (no zone designator)
 */
export const leapSecond: RegExp = /T\d{2}:\d{2}:60(?:[.,]\d+)?(?:[-+Zz[])/;

/**
 * RegExp fragment matching an ISO 8601 leap second in every shape
 * `Temporal.Instant.from` accepts — the wider sibling of `leapSecond`.
 *
 * - Accepts `T`, `t` or a space as the date/time separator, and extended (`23:59:60`) or
 *   basic (`235960`) time digits.
 * - `leapSecond` matches only an uppercase `T` with extended digits, which is all `utc/`'s
 *   stricter `<date>T<time>Z` gate can ever hand it. The full instant grammar is wider, so
 *   matching it needs this: without it `"2016-12-31 23:59:60Z"` slips through and Temporal
 *   silently clamps it to `:59`.
 * - Use `leapSecond` when the input is already gated to GMT's `<date>T<time>Z` shape, and
 *   this when it is anything `Temporal.Instant.from` will parse.
 *
 * @example instantLeapSecond.test("2016-12-31T23:59:60Z")   // true
 * @example instantLeapSecond.test("2016-12-31 23:59:60Z")   // true (space separator)
 * @example instantLeapSecond.test("20161231t235960Z")       // true (basic format)
 * @example instantLeapSecond.test("2016-12-31T23:59:59Z")   // false (second = 59)
 * @example instantLeapSecond.test("2016-12-31T23:59:60")    // false (no zone designator)
 */
export const instantLeapSecond: RegExp =
  /[Tt ]\d{2}:?\d{2}:?60(?:[.,]\d+)?(?:[-+Zz[])/;
