/**
 * RegExp fragment matching an ISO 8601 leap second (second `60`) in the time of day of a
 * date-time or time string, in every spelling Temporal's `PlainDateTime.from`/`PlainTime.from`
 * grammar parses.
 *
 * - Detects second = 60 within a date-time or time string, not a full standalone value.
 * - Covers a `T`, `t` or space date/time separator (`DateTimeSeparator`), extended (`23:59:60`)
 *   or basic (`235960`) time digits, extended or basic date digits, and a bare time with or
 *   without a `T`/`t` designator (`TimeSpec`). The second may be followed by a fraction, then
 *   `Z`/`z`, a numeric offset, `[` opening an annotation, or the end of the string: Temporal's
 *   ParseISODateTime silently clamps a second of 60 to 59 in each case, so a guard that misses
 *   a spelling lets that clamp through.
 * - Looks only before the first `[`. An RFC 9557 annotation value is `1*alphanum` joined by
 *   `-` (§4.1), so `[x=T123460Z]` is a legal elective tag, not a time of day.
 * - Rejecting a leap second is GMT's decision, not the grammar's range: Temporal's
 *   `TimeSecond` and RFC 3339's `time-second` both admit 60. GMT refuses the value because
 *   Temporal cannot represent it and would otherwise read it as `:59`.
 * - Used by `isLeapSecond`. Validators reject a second of 60 in their own patterns.
 *
 * @example leapSecond.test("2024-12-31T23:59:60Z")                // true
 * @example leapSecond.test("2024-12-31T23:59:60.123+00:00")       // true
 * @example leapSecond.test("2024-12-31t23:59:60+00:00[UTC]")      // true (lowercase t)
 * @example leapSecond.test("20241231 235960Z")                    // true (space separator, basic format)
 * @example leapSecond.test("2024-12-31T23:59:60")                 // true (no designator: PlainDateTime clamps it)
 * @example leapSecond.test("23:59:60")                            // true (a time: PlainTime clamps it)
 * @example leapSecond.test("2024-12-31T23:59:59Z")                // false (second = 59)
 * @example leapSecond.test("2024-01-01T00:00:00Z[x=T123460Z]")    // false (inside an annotation value)
 */
export const leapSecond: RegExp =
  /^(?:[^[]*?[Tt ]|[Tt]?)\d{2}:?\d{2}:?60(?:[.,]\d+)?(?:[-+Zz[]|$)/;

/**
 * RegExp fragment matching an ISO 8601 leap second in every shape `Temporal.Instant.from`
 * accepts.
 *
 * - An instant has a date, a `T`, `t` or space separator and a designator (`Z`/`z` or an
 *   offset), so a second of 60 must be followed by a fraction or that designator (or `[`).
 * - Covers extended (`23:59:60`) or basic (`235960`) time digits, and nothing inside an
 *   RFC 9557 annotation value.
 *
 * @example instantLeapSecond.test("2016-12-31T23:59:60Z")              // true
 * @example instantLeapSecond.test("2016-12-31 23:59:60Z")              // true (space separator)
 * @example instantLeapSecond.test("20161231t235960Z")                  // true (basic format)
 * @example instantLeapSecond.test("2016-12-31T23:59:59Z")              // false (second = 59)
 * @example instantLeapSecond.test("2016-12-31T23:59:60")               // false (no designator, so not an instant)
 * @example instantLeapSecond.test("2024-01-01T00:00:00Z[x=T123460Z]")  // false (inside an annotation value)
 */
export const instantLeapSecond: RegExp =
  /^[^[]*?[Tt ]\d{2}:?\d{2}:?60(?:[.,]\d+)?[-+Zz[]/;
