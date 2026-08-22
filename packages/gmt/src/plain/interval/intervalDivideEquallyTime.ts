import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeInterval } from "./validate";

/**
 * Split a time interval into `n` equal-length sub-intervals.
 *
 * - Returns an array of `n` `{ start, end }` records that tile the original interval, each
 *   record's `end` equal to the next record's `start`.
 * - Time units are fixed-length, so boundaries are computed to nanosecond precision — the split
 *   is exact whenever the total nanoseconds divides evenly by `n`, and off by at most one
 *   nanosecond otherwise.
 * - `n === 1` returns the original interval unchanged, as a single-element array.
 * - A zero-length interval (`start === end`) returns `n` identical zero-length sub-intervals.
 * - Returns `[]` when `n` is not a positive integer, or on invalid input (unparseable
 *   start/end, `start > end`).
 *
 * @param start ISO PlainTime string for the interval start
 * @param end ISO PlainTime string for the interval end
 * @param n number of equal sub-intervals to produce (positive integer)
 * @returns array of `n` `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalDivideEquallyTime("09:00:00", "17:00:00", 4) // [{ start: "09:00:00", end: "11:00:00" }, { start: "11:00:00", end: "13:00:00" }, { start: "13:00:00", end: "15:00:00" }, { start: "15:00:00", end: "17:00:00" }]
 * @example intervalDivideEquallyTime("09:00:00", "17:00:00", 3) // [{ start: "09:00:00", end: "11:40:00" }, { start: "11:40:00", end: "14:20:00" }, { start: "14:20:00", end: "17:00:00" }]
 * @example intervalDivideEquallyTime("09:00:00", "17:00:00", 1) // [{ start: "09:00:00", end: "17:00:00" }]
 * @example intervalDivideEquallyTime("09:00:00", "17:00:00", 0) // []
 * @example intervalDivideEquallyTime("invalid", "17:00:00", 3) // []
 */
export function intervalDivideEquallyTime(
  start: string,
  end: string,
  n: number,
): Array<{ start: string; end: string }> {
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
    return [];
  }

  if (!isValidTimeInterval(start, end)) {
    return [];
  }

  try {
    const startVal = Temporal.PlainTime.from(start);
    const endVal = Temporal.PlainTime.from(end);

    if (startVal.equals(endVal)) {
      return Array.from({ length: n }, () => ({
        start: startVal.toString(),
        end: endVal.toString(),
      }));
    }

    const totalNs = startVal
      .until(endVal, { largestUnit: "nanosecond" })
      .total("nanosecond");

    const boundaries: Temporal.PlainTime[] = [startVal];
    for (let i = 1; i < n; i++) {
      boundaries.push(
        startVal.add({ nanoseconds: Math.round((totalNs * i) / n) }),
      );
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
