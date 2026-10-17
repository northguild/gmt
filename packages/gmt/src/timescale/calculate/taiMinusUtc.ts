import {
  LEAP_SECOND_STEPS,
  NANOSECONDS_PER_SECOND,
  parseUtcReading,
  taiOfUtc,
} from "../../internal";

/**
 * Return TAI − UTC, in whole seconds, at a UTC instant.
 *
 * - From the IERS leap-second table built into GMT (Leap_Second.dat through Bulletin C 72,
 *   6 July 2026): 10 s from 1972-01-01, 37 s from 2017-01-01 on. The table is closed
 *   (continuous UTC from 20 May 2027, CGPM 2026), so 37 holds for every later date.
 * - At an inserted leap second (`…T23:59:60Z`, accepted only on the 27 listed days) the value is
 *   the one before the insertion: TAI − UTC changes at 00:00:00 UTC.
 * - `null` before 1972-01-01 (TAI − UTC was then fractional with a daily rate term), for a
 *   second-60 string on a day with no insertion, and on invalid input.
 *
 * @param isoString ISO 8601 instant string; a listed leap second (`…T23:59:60Z`) is accepted
 * @returns TAI − UTC in seconds, or null on invalid input or a date before 1972
 *
 * @example taiMinusUtc("2024-01-01T00:00:00Z") // 37
 * @example taiMinusUtc("2016-01-01T00:00:00Z") // 36
 * @example taiMinusUtc("2016-12-31T23:59:60Z") // 36 — the inserted second
 * @example taiMinusUtc("2100-01-01T00:00:00Z") // 37
 * @example taiMinusUtc("1971-01-01T00:00:00Z") // null — before 1972
 */
export function taiMinusUtc(isoString: string): number | null {
  try {
    const reading = parseUtcReading(isoString);
    if (reading === null) {
      return null;
    }
    const tai = taiOfUtc(LEAP_SECOND_STEPS, reading);
    if (tai === null) {
      return null;
    }
    return (
      Number((tai - reading.epochNanoseconds) / NANOSECONDS_PER_SECOND) -
      (reading.secondSixty ? 1 : 0)
    );
  } catch {
    return null;
  }
}
