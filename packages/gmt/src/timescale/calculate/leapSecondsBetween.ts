import { taiMinusUtc } from "./taiMinusUtc";

/**
 * Return how many leap seconds fall between two UTC instants: the change in TAI − UTC.
 *
 * - From the IERS leap-second table built into GMT (Leap_Second.dat through Bulletin C 72,
 *   6 July 2026). The table is closed: after the last insertion (2016-12-31) there are none.
 * - Counts each leap second whose second starts in `[start, end)`: from `…T23:59:60Z` to the next
 *   `…T00:00:00Z` is 1; from `…T23:59:59Z` to `…T23:59:60Z` is 0.
 * - Signed: negative when `end` is before `start`.
 * - `null` when either instant is before 1972-01-01 or invalid.
 *
 * @param start ISO 8601 instant string
 * @param end ISO 8601 instant string
 * @returns the signed count, or null on invalid input or a date before 1972
 *
 * @example leapSecondsBetween("2020-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // 0
 * @example leapSecondsBetween("2000-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // 5
 * @example leapSecondsBetween("2024-01-01T00:00:00Z", "2000-01-01T00:00:00Z") // -5
 * @example leapSecondsBetween("2016-12-31T23:59:60Z", "2017-01-01T00:00:00Z") // 1
 * @example leapSecondsBetween("1971-01-01T00:00:00Z", "2024-01-01T00:00:00Z") // null
 */
export function leapSecondsBetween(start: string, end: string): number | null {
  try {
    const before = taiMinusUtc(start);
    const after = taiMinusUtc(end);
    if (before === null || after === null) {
      return null;
    }
    return after - before;
  } catch {
    return null;
  }
}
