import {
  halfOpenContainsPoint,
  halfOpenContainsSpan,
  parseUnixEpochInterval,
  parseUnixEpochValue,
} from "../../internal";

const compareEpoch = (left: number, right: number) => left - right;

/**
 * Return true when `pointOrStart` falls within the half-open interval
 * `[intervalStart, intervalEnd)` (3-arg), or when the inner interval `[innerStart, innerEnd)` lies
 * within the outer interval `[intervalStart, intervalEnd)` (4-arg).
 *
 * - Compares numeric Unix epoch values directly.
 * - Point mode: `start <= point < end`, the same rule as `intervalContains`. The `end` is
 *   excluded, so a point at `end` returns `false`, and an empty interval (`start === end`)
 *   contains no point.
 * - Interval mode: the intervals overlap and `start <= innerStart` and `innerEnd <= end`. An inner
 *   interval may share the outer `end`. An empty inner interval counts only strictly inside the
 *   outer interval, the same edge rule as `clampInterval`, and an empty outer interval contains
 *   nothing.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input: non-numeric types, empty strings, and values that are not
 *   safe integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param intervalStart Unix epoch value, in the one unit all epoch arguments share — outer interval start
 * @param intervalEnd Unix epoch value, in the one unit all epoch arguments share — outer interval end
 * @param pointOrStart Unix epoch value for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional Unix epoch value for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsUnix(0, 1700000000, 170000000) // true
 * @example intervalContainsUnix(0, 1700000000, 1700000000) // false (the end is excluded)
 * @example intervalContainsUnix(0, 1700000000, 1500000000, 1700000000) // true (the inner interval shares the end)
 * @example intervalContainsUnix(0, 1700000000, 170000000, 1500000000) // true
 * @example intervalContainsUnix(1700000000, 0, 170000000) // false
 * @example intervalContainsUnix(0, 1700000000, 170000000, 15000000) // false
 * @example intervalContainsUnix(NaN, 1700000000, 170000000) // false
 * @example intervalContainsUnix("0", "1700000000", "170000000") // true
 * @example intervalContainsUnix(0, 10, 0.5) // false (fractional epoch)
 */
export function intervalContainsUnix(
  intervalStart: number | string,
  intervalEnd: number | string,
  pointOrStart: number | string,
  pointEnd?: number | string,
): boolean {
  const outer = parseUnixEpochInterval(intervalStart, intervalEnd);

  if (outer === null) {
    return false;
  }

  if (pointEnd === undefined) {
    const point = parseUnixEpochValue(pointOrStart);
    return point !== null && halfOpenContainsPoint(outer, point, compareEpoch);
  }

  const inner = parseUnixEpochInterval(pointOrStart, pointEnd);

  return inner !== null && halfOpenContainsSpan(outer, inner, compareEpoch);
}
