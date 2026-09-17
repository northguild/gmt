import { halfOpenOverlap, parseUnixEpochIntervalPair } from "../../internal";

/**
 * Return true when the half-open intervals `[aStart, aEnd)` and `[bStart, bEnd)` share at least
 * one instant.
 *
 * - Compares numeric Unix epoch values directly: `aStart < bEnd && bStart < aEnd`, the same rule as
 *   `intervalsOverlap` (SQL:2011 `OVERLAPS` on closed-open periods).
 * - An interval excludes its `end`, so touching intervals (`aEnd` equal to `bStart`) do NOT
 *   overlap — returns `false`.
 * - An empty interval (`start === end`) overlaps an interval only when it lies strictly inside it;
 *   at either edge, or against another empty interval, it returns `false`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input: non-numeric types, empty strings, and values that are not
 *   safe integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — first interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — first interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — second interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — second interval end
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapUnix(0, 1700000000, 1000000, 2000000) // true
 * @example intervalsOverlapUnix(0, 1000000, 1000000, 2000000) // false (touching: [0, 1000000) excludes 1000000)
 * @example intervalsOverlapUnix(0, 1000001, 1000000, 2000000) // true (one unit shared)
 * @example intervalsOverlapUnix(NaN, 1700000000, 1000000, 2000000) // false
 * @example intervalsOverlapUnix("0", "1700000000", "1000000", "2000000") // true
 */
export function intervalsOverlapUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): boolean {
  const pair = parseUnixEpochIntervalPair(aStart, aEnd, bStart, bEnd);

  if (pair === null) {
    return false;
  }

  // Each interval starts before the other's exclusive end.
  return halfOpenOverlap(pair[0], pair[1], (left, right) => left - right);
}
