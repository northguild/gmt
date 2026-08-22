import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { isValidZonedInterval } from "./validate";

/**
 * Split a zoned interval into `n` equal-length sub-intervals.
 *
 * - Returns an array of `n` `{ start, end }` records that tile the original interval, each
 *   record's `end` equal to the next record's `start`.
 * - Boundaries are computed from the total elapsed real time (nanoseconds, via
 *   `Duration.prototype.total` with `relativeTo` set to `start`), so a spring-forward day split
 *   in half lands exactly on the DST transition's real midpoint rather than the local-clock
 *   midpoint.
 * - `n === 1` returns the original interval unchanged, as a single-element array.
 * - A zero-length interval (`start === end`) returns `n` identical zero-length sub-intervals.
 * - Returns `[]` when `n` is not a positive integer, or on invalid input (unparseable
 *   start/end, `start > end`, leap-second strings).
 *
 * @param start ISO 8601 zoned datetime string for the interval start
 * @param end ISO 8601 zoned datetime string for the interval end
 * @param n number of equal sub-intervals to produce (positive integer)
 * @returns array of `n` `{ start, end }` records, or `[]` on invalid input
 *
 * @example intervalDivideEquallyZoned("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]", 2) // [{ start: "2024-03-09T12:00:00-05:00[America/New_York]", end: "2024-03-10T12:30:00-04:00[America/New_York]" }, { start: "2024-03-10T12:30:00-04:00[America/New_York]", end: "2024-03-11T12:00:00-04:00[America/New_York]" }] (47 real hours split in half)
 * @example intervalDivideEquallyZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-04T00:00:00+00:00[UTC]", 1) // [{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-04T00:00:00+00:00[UTC]" }]
 * @example intervalDivideEquallyZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-01-04T00:00:00+00:00[UTC]", 0) // []
 * @example intervalDivideEquallyZoned("invalid", "2024-01-04T00:00:00+00:00[UTC]", 3) // []
 */
export function intervalDivideEquallyZoned(
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

  if (!isValidZonedInterval(start, end)) {
    return [];
  }

  try {
    const startVal = Temporal.ZonedDateTime.from(start);
    const endVal = Temporal.ZonedDateTime.from(end);

    if (startVal.toInstant().equals(endVal.toInstant())) {
      return Array.from({ length: n }, () => ({
        start: startVal.toString(),
        end: endVal.toString(),
      }));
    }

    const totalNs = startVal
      .until(endVal, { largestUnit: "nanosecond" })
      .total({ unit: "nanosecond", relativeTo: startVal });

    const boundaries: Temporal.ZonedDateTime[] = [startVal];
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
