import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeInterval } from "./validate";

/**
 * Split a datetime interval into `n` equal-length sub-intervals.
 *
 * - Returns an array of `n` `{ start, end }` records that tile the original interval, each
 *   record's `end` equal to the next record's `start`.
 * - Boundaries are computed from the total elapsed nanoseconds (via `Duration.prototype.total`
 *   with `relativeTo` set to `start`), so the split is exact whenever the total divides evenly
 *   by `n`, and off by at most one nanosecond otherwise.
 * - `n === 1` returns the original interval unchanged, as a single-element array.
 * - A zero-length interval (`start === end`) returns `n` identical zero-length sub-intervals.
 * - Returns `[]` when `n` is not a positive integer, or on invalid input (unparseable
 *   start/end, `start > end`).
 *
 * @param start ISO PlainDateTime string for the interval start
 * @param end ISO PlainDateTime string for the interval end
 * @param n number of equal sub-intervals to produce (positive integer)
 * @returns array of `n` `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalDivideEquallyDateTime("2024-01-01T00:00:00", "2024-01-04T00:00:00", 3) // [{ start: "2024-01-01T00:00:00", end: "2024-01-02T00:00:00" }, { start: "2024-01-02T00:00:00", end: "2024-01-03T00:00:00" }, { start: "2024-01-03T00:00:00", end: "2024-01-04T00:00:00" }]
 * @example intervalDivideEquallyDateTime("2024-01-01T00:00:00", "2024-01-04T00:00:00", 1) // [{ start: "2024-01-01T00:00:00", end: "2024-01-04T00:00:00" }]
 * @example intervalDivideEquallyDateTime("2024-01-01T00:00:00", "2024-01-04T00:00:00", 0) // []
 * @example intervalDivideEquallyDateTime("invalid", "2024-01-04T00:00:00", 3) // []
 */
export function intervalDivideEquallyDateTime(
  start: string,
  end: string,
  n: number,
): Array<{ start: string; end: string }> {
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
    return [];
  }

  if (!isValidDateTimeInterval(start, end)) {
    return [];
  }

  try {
    const startVal = Temporal.PlainDateTime.from(start);
    const endVal = Temporal.PlainDateTime.from(end);

    if (startVal.equals(endVal)) {
      return Array.from({ length: n }, () => ({
        start: startVal.toString(),
        end: endVal.toString(),
      }));
    }

    const totalNs = startVal
      .until(endVal, { largestUnit: "nanosecond" })
      .total({ unit: "nanosecond", relativeTo: startVal });

    const boundaries: Temporal.PlainDateTime[] = [startVal];
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
