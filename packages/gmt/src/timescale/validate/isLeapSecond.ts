import { LEAP_SECOND_STEPS, parseUtcReading, taiOfUtc } from "../../internal";

/**
 * Return true when a UTC instant string is one of the 27 inserted leap seconds.
 *
 * - A table lookup, not a pattern match: `23:59:60` is well-formed on any day and real on 27 of
 *   them, the days the IERS leap-second table built into GMT lists (Leap_Second.dat through
 *   Bulletin C 72, 6 July 2026). The table is closed (continuous UTC from 20 May 2027, CGPM
 *   2026), so 2016-12-31 is the last. For the syntax test alone, use `hasSecond60`.
 * - Accepts the inserted second in any offset spelling (`2017-01-01T08:59:60+09:00`).
 * - Leap smearing is not a leap second: a smeared clock never reads `23:59:60` and is up to a second
 *   off true UTC around an insertion. GMT cannot detect smearing.
 * - `false` is also the answer for every ordinary second.
 * - **Compatibility:** in 1.19.0 and earlier `isLeapSecond` (in `plain/`) was the syntactic
 *   second-60 test, now `hasSecond60`; a call relying on that now returns `false` on days with no
 *   insertion, and for a second 60 that is not an extended-format instant (`"23:59:60"`, no
 *   designator, a lowercase `t`, basic format).
 *
 * @param isoString ISO 8601 instant string
 * @returns true for an inserted leap second, or false otherwise and on invalid input
 *
 * @example isLeapSecond("2016-12-31T23:59:60Z") // true
 * @example isLeapSecond("2009-01-01T08:59:60+09:00") // true
 * @example isLeapSecond("2017-12-31T23:59:60Z") // false — well-formed, no insertion that day
 * @example isLeapSecond("2016-12-31T23:59:59Z") // false
 */
export function isLeapSecond(isoString: string): boolean {
  try {
    const reading = parseUtcReading(isoString);
    return (
      reading !== null &&
      reading.secondSixty &&
      taiOfUtc(LEAP_SECOND_STEPS, reading) !== null
    );
  } catch {
    return false;
  }
}
