import { parseUnixEpochIntervalPair } from "../../internal";

/**
 * Return true when intervals `[aStart, aEnd]` and `[bStart, bEnd]` share at least one instant.
 *
 * - Compares numeric Unix epoch values directly.
 * - Touching intervals (`aEnd` equal to `bStart`) share that endpoint and DO overlap — returns `true`.
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
 * @example intervalsOverlapUnix(0, 1000000, 1000000, 2000000) // true (touching)
 * @example intervalsOverlapUnix(0, 1000000, 1000001, 2000000) // false (disjoint)
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

  const [a, b] = pair;

  // Neither interval ends before the other starts.
  return a.end >= b.start && b.end >= a.start;
}
