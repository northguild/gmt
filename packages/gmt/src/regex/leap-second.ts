/**
 * RegExp fragment matching an ISO 8601 leap second (second `60`) in the time of day of a
 * date-time string that carries a designator after it: `Z`/`z`, a numeric offset, or `[`
 * opening a bracketed annotation.
 *
 * - Detects second = 60 within a date-time string, not a full standalone value.
 * - Covers every spelling Temporal's grammar accepts: a `T`, `t` or space date/time separator
 *   (`DateTimeSeparator`), extended (`23:59:60`) or basic (`235960`) time digits, and
 *   extended or basic date digits. Temporal's ParseISODateTime silently clamps a second of
 *   60 to 59, so a guard that misses a spelling lets that clamp through.
 * - Looks only before the first `[`. An RFC 9557 annotation value is `1*alphanum` joined by
 *   `-` (§4.1), so `[x=T123460Z]` is a legal elective tag, not a time of day.
 * - Rejecting a leap second is GMT's decision, not the grammar's range: Temporal's
 *   `TimeSecond` and RFC 3339's `time-second` both admit 60. GMT refuses the value because
 *   Temporal cannot represent it and would otherwise read it as `:59`.
 * - Used to identify and reject leap-second values before Temporal parsing.
 *
 * @example leapSecond.test("2024-12-31T23:59:60Z")                // true
 * @example leapSecond.test("2024-12-31T23:59:60.123+00:00")       // true
 * @example leapSecond.test("2024-12-31t23:59:60+00:00[UTC]")      // true (lowercase t)
 * @example leapSecond.test("20241231 235960Z")                    // true (space separator, basic format)
 * @example leapSecond.test("2024-12-31T23:59:59Z")                // false (second = 59)
 * @example leapSecond.test("2024-12-31T23:59:60")                 // false (no zone designator)
 * @example leapSecond.test("2024-01-01T00:00:00Z[x=T123460Z]")    // false (inside an annotation value)
 */
export const leapSecond: RegExp =
  /^[^[]*?[Tt ]\d{2}:?\d{2}:?60(?:[.,]\d+)?[-+Zz[]/;

/**
 * RegExp fragment matching an ISO 8601 leap second in every shape `Temporal.Instant.from`
 * accepts.
 *
 * - The same pattern as `leapSecond`, which now covers the full instant grammar too: `T`, `t`
 *   or a space as the date/time separator, extended (`23:59:60`) or basic (`235960`) time
 *   digits, and nothing inside an RFC 9557 annotation value.
 * - Kept as its own export so existing imports keep working.
 *
 * @example instantLeapSecond.test("2016-12-31T23:59:60Z")              // true
 * @example instantLeapSecond.test("2016-12-31 23:59:60Z")              // true (space separator)
 * @example instantLeapSecond.test("20161231t235960Z")                  // true (basic format)
 * @example instantLeapSecond.test("2016-12-31T23:59:59Z")              // false (second = 59)
 * @example instantLeapSecond.test("2016-12-31T23:59:60")               // false (no zone designator)
 * @example instantLeapSecond.test("2024-01-01T00:00:00Z[x=T123460Z]")  // false (inside an annotation value)
 */
export const instantLeapSecond: RegExp = leapSecond;
