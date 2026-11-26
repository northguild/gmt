/**
 * A time scale a Julian Date, Modified Julian Date or J2000 count can be taken on: UTC, TAI,
 * Terrestrial Time or Geocentric Coordinate Time. TDB is not one: GMT does not provide it.
 *
 * @example
 * const scale: TimeScale = "TT";
 */
export type TimeScale = "UTC" | "TAI" | "TT" | "TCG";

/**
 * A Julian Date in two parts, whose sum is the JD (ERFA `jd2cal.c` Note 2: the date "is
 * apportioned in any convenient way between the arguments").
 *
 * @example
 * const parts: JulianDateParts = { jd1: 2451545, jd2: 0 }; // J2000.0
 */
export interface JulianDateParts {
  /** Whole days. `to*` writes a whole number; `from*` accepts any finite number. */
  jd1: number;
  /** The rest of the day. `to*` writes a value from 0 up to but not including 1. */
  jd2: number;
}
