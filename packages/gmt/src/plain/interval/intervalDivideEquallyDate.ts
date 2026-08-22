import { Temporal } from "@js-temporal/polyfill";
import { isValidDateInterval } from "./validate";

/**
 * Split a date interval into `n` equal-length sub-intervals.
 *
 * - Returns an array of `n` `{ start, end }` records that tile the original interval, each
 *   record's `end` equal to the next record's `start`.
 * - `PlainDate` has no fractional-day representation, so each internal boundary is rounded to
 *   the nearest whole day — when `totalDays` isn't evenly divisible by `n`, the resulting
 *   sub-intervals differ by at most one day rather than being mathematically exact.
 * - `n === 1` returns the original interval unchanged, as a single-element array.
 * - A zero-length interval (`start === end`) returns `n` identical zero-length sub-intervals.
 * - Returns `[]` when `n` is not a positive integer, or on invalid input (unparseable
 *   start/end, `start > end`).
 *
 * @param start ISO PlainDate string for the interval start
 * @param end ISO PlainDate string for the interval end
 * @param n number of equal sub-intervals to produce (positive integer)
 * @returns array of `n` `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalDivideEquallyDate("2024-01-01", "2024-01-05", 4) // [{ start: "2024-01-01", end: "2024-01-02" }, { start: "2024-01-02", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-04" }, { start: "2024-01-04", end: "2024-01-05" }]
 * @example intervalDivideEquallyDate("2024-01-01", "2024-01-10", 3) // [{ start: "2024-01-01", end: "2024-01-04" }, { start: "2024-01-04", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-10" }]
 * @example intervalDivideEquallyDate("2024-01-01", "2024-01-10", 1) // [{ start: "2024-01-01", end: "2024-01-10" }]
 * @example intervalDivideEquallyDate("2024-01-01", "2024-01-01", 3) // [{ start: "2024-01-01", end: "2024-01-01" }, { start: "2024-01-01", end: "2024-01-01" }, { start: "2024-01-01", end: "2024-01-01" }]
 * @example intervalDivideEquallyDate("2024-01-01", "2024-01-10", 0) // []
 * @example intervalDivideEquallyDate("invalid", "2024-01-10", 3) // []
 */
export function intervalDivideEquallyDate(
  start: string,
  end: string,
  n: number,
): Array<{ start: string; end: string }> {
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
    return [];
  }

  if (!isValidDateInterval(start, end)) {
    return [];
  }

  try {
    const startVal = Temporal.PlainDate.from(start);
    const endVal = Temporal.PlainDate.from(end);

    if (startVal.equals(endVal)) {
      return Array.from({ length: n }, () => ({
        start: startVal.toString(),
        end: endVal.toString(),
      }));
    }

    const totalDays = startVal.until(endVal, { largestUnit: "day" }).days;

    const boundaries: Temporal.PlainDate[] = [startVal];
    for (let i = 1; i < n; i++) {
      boundaries.push(startVal.add({ days: Math.round((totalDays * i) / n) }));
    }
    boundaries.push(endVal);

    const result: Array<{ start: string; end: string }> = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      result.push({
        start: boundaries[i].toString(),
        end: boundaries[i + 1].toString(),
      });
    }

    return result;
  } catch {
    return [];
  }
}
