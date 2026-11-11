import type { TimeScale } from "../../types/time-scale";
import {
  dayPositionOf,
  epochDaysOfJulianDate,
  isTimeScale,
  julianDatePartsOf,
  LEAP_SECOND_STEPS,
  parseUtcReading,
  readsBackInDomain,
} from "../../internal";

/**
 * Convert a UTC instant to a single Julian Date on a time scale. The scale defaults to `"UTC"`.
 *
 * - A single double resolves a Julian Date only to about 40 µs (2⁻³¹ day) for dates from 1972 to
 *   6771, so any one value can be up to 20 µs off; after 6771, 80 µs and 40 µs. Use
 *   `toJulianDateParts` for nanosecond precision, or `toModifiedJulianDate`, which keeps about 64
 *   times more digits for dates before 2038.
 * - JD days begin at noon (IAU 1997 B1 App. 2): midnight UTC is `.5`. The result is `jd1 + jd2`
 *   of the parts `toJulianDateParts` writes, one IEEE 754 addition.
 * - On `"UTC"` the count is ERFA's quasi-JD, the same as `toJulianDateParts`: a leap-second day
 *   counts as one day. On `"TAI"`, `"TT"` and `"TCG"` it is a true JD. TDB is not available.
 * - Accepts any offset or bracketed zone, and a listed leap second `…T23:59:60Z`.
 * - Domain: 1972-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z UTC; `null` outside it. Within
 *   half a double's spacing of 1972-01-01 (on TAI and TT; at most about 20 µs, measured 6.1 µs on
 *   TAI and 19.8 µs on TT) or of the end of 9999 (on UTC, TAI and TT; at most about 40 µs) it also
 *   returns `null`, because the nearest double lies outside the domain and `fromJulianDate`
 *   would reject it; `toJulianDateParts` covers the whole domain exactly.
 *
 * @param isoString ISO 8601 instant string
 * @param scale the time scale to count on, default `"UTC"`
 * @returns the Julian Date, or null on invalid input, an unknown scale or an instant outside the domain
 *
 * @example toJulianDate("2000-01-01T12:00:00Z") // 2451545
 * @example toJulianDate("2000-01-01T00:00:00Z") // 2451544.5
 * @example toJulianDate("2000-01-01T11:58:55.816Z", "TT") // 2451545
 * @example toJulianDate("2026-01-01T12:00:00.00002Z") // 2461042 — a double there is 40.2 µs wide, so 20 µs past noon rounds back to noon
 * @example toJulianDate("1971-12-31T23:59:59Z") // null — before 1972
 */
export function toJulianDate(
  isoString: string,
  scale: TimeScale = "UTC",
): number | null {
  try {
    if (!isTimeScale(scale)) {
      return null;
    }
    const reading = parseUtcReading(isoString);
    if (reading === null) {
      return null;
    }
    const position = dayPositionOf(LEAP_SECOND_STEPS, reading, scale);
    if (position === null) {
      return null;
    }
    const { jd1, jd2 } = julianDatePartsOf(position);
    const jd = jd1 + jd2;
    return readsBackInDomain(
      epochDaysOfJulianDate(jd),
      LEAP_SECOND_STEPS,
      scale,
    )
      ? jd
      : null;
  } catch {
    return null;
  }
}
