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
