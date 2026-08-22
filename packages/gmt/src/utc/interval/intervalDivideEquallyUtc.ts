import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isValidUtcInterval } from "./validate";

/**
 * Split a UTC interval into `n` equal-length sub-intervals.
 *
 * - Returns an array of `n` `{ start, end }` records that tile the original interval, each
 *   record's `end` equal to the next record's `start`.
 * - Boundaries are computed from the total elapsed nanoseconds (via `Duration.prototype.total`
 *   with `relativeTo` set to `start`) — no DST is involved, since UTC has no time zone offset.
 * - `n === 1` returns the original interval unchanged, as a single-element array.
 * - A zero-length interval (`start === end`) returns `n` identical zero-length sub-intervals.
 * - Returns `[]` when `n` is not a positive integer, or on invalid input (unparseable
 *   start/end, `start > end`, leap-second strings).
 *
 * @param start ISO UTC datetime string for the interval start
 * @param end ISO UTC datetime string for the interval end
 * @param n number of equal sub-intervals to produce (positive integer)
 * @returns array of `n` `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2024-01-04T00:00:00Z", 3) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }, { start: "2024-01-02T00:00:00Z", end: "2024-01-03T00:00:00Z" }, { start: "2024-01-03T00:00:00Z", end: "2024-01-04T00:00:00Z" }]
 * @example intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2024-01-04T00:00:00Z", 1) // [{ start: "2024-01-01T00:00:00Z", end: "2024-01-04T00:00:00Z" }]
 * @example intervalDivideEquallyUtc("2024-01-01T00:00:00Z", "2024-01-04T00:00:00Z", 0) // []
 * @example intervalDivideEquallyUtc("invalid", "2024-01-04T00:00:00Z", 3) // []
 */
export function intervalDivideEquallyUtc(
  start: string,
  end: string,
  n: number,
): Array<{ start: string; end: string }> {
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
    return [];
  }

  if (isLeapSecond(start) || isLeapSecond(end)) {
    return [];
  }

  if (!isValidUtcInterval(start, end)) {
    return [];
  }

  try {
    const startVal = Temporal.Instant.from(start);
    const endVal = Temporal.Instant.from(end);

    if (startVal.equals(endVal)) {
      return Array.from({ length: n }, () => ({
        start: startVal.toString(),
        end: endVal.toString(),
      }));
    }

    const totalNs = startVal
      .until(endVal, { largestUnit: "nanosecond" })
      .total("nanosecond");

    const boundaries: Temporal.Instant[] = [startVal];
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
