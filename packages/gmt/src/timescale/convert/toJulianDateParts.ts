import type { JulianDateParts, TimeScale } from "../../types/time-scale";
import {
  dayPositionOf,
  isTimeScale,
  julianDatePartsOf,
  LEAP_SECOND_STEPS,
  parseUtcReading,
} from "../../internal";

/**
 * Convert a UTC instant to a two-part Julian Date `{ jd1, jd2 }` on a time scale, exact to the
 * nanosecond. The scale defaults to `"UTC"`.
 *
 * - Two parts exist because one double near JD 2 460 000 resolves only to about 40 µs. For a
 *   single number use `toJulianDate`.
 * - JD days begin at noon (IAU 1997 B1 App. 2): midnight UTC has `jd2 = 0.5`.
 * - `jd1` is a whole number and `jd2` lies in [0, 1). `fromJulianDateParts` accepts any split.
 * - `jd2` is one correctly rounded division (IEEE 754-2019 §4.3), within 2⁻⁵⁴ day (0.0048 ns) of
 *   the exact value; times at most 86 401 s that stays under 0.01 ns, so rounding to the nearest
 *   nanosecond recovers the input: `fromJulianDateParts(toJulianDateParts(x, s), s)` is `x` in
 *   `Z` form with Temporal's shortest fraction, on every instant in the domain and every scale.
 * - On `"UTC"` the count is ERFA's quasi-JD: a leap-second day counts as one day, so noon on that
 *   day is not `.0`, and the difference between two UTC JDs is not an exact interval (ERFA
 *   `dtf2d.c` Notes 4 and 7). On `"TAI"`, `"TT"` and `"TCG"` it is a true JD, read from the label
 *   `toTAI` / `toTT` / `toTCG` writes. TDB is not available.
 * - Accepts any offset or bracketed zone, and a listed leap second `…T23:59:60Z`.
 * - Domain: 1972-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z UTC; `null` outside it.
 *
 * @param isoString ISO 8601 instant string
 * @param scale the time scale to count on, default `"UTC"`
 * @returns the two parts, or null on invalid input, an unknown scale or an instant outside the domain
 *
 * @example toJulianDateParts("2000-01-01T12:00:00Z") // { jd1: 2451545, jd2: 0 }
 * @example toJulianDateParts("2000-01-01T00:00:00Z") // { jd1: 2451544, jd2: 0.5 }
 * @example toJulianDateParts("2000-01-01T11:58:55.816Z", "TT") // { jd1: 2451545, jd2: 0 }
 * @example toJulianDateParts("2016-12-31T23:59:60Z") // { jd1: 2457754, jd2: 0.4999884260598836 } (86399 / 172802)
 * @example toJulianDateParts("2026-01-01T00:00:00Z", "TAI") // { jd1: 2461041, jd2: 0.50042824... }
 * @example toJulianDateParts("1971-12-31T23:59:59Z") // null — before 1972
 */
export function toJulianDateParts(
  isoString: string,
  scale: TimeScale = "UTC",
): JulianDateParts | null {
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
    return julianDatePartsOf(position);
  } catch {
    return null;
  }
}
