import {
  halfOpenIntersection,
  parseUnixEpochIntervalPair,
} from "../../internal";

/**
 * Return the overlapping span of two half-open Unix epoch intervals `[start, end)`, or null when
 * they do not overlap.
 *
 * - Compares numeric Unix epoch values directly.
 * - The result is `[max(aStart, bStart), min(aEnd, bEnd))`, and it exists only when
 *   `intervalsOverlapUnix` is true — the same rule as `intersectIntervals`.
 * - Touching intervals (e.g. `aEnd === bStart`) share no instant, because each `end` is excluded,
 *   and return `null`.
 * - An empty interval (`start === end`) strictly inside the other returns itself; at either edge,
 *   or against another empty interval, it returns `null`.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input: non-numeric types, empty strings, and values that are not
 *   safe integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — first interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — first interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — second interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — second interval end
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap
 *
 * @example intervalIntersectionUnix(0, 1700000000, 1000000, 2000000) // { start: 1000000, end: 2000000 }
 * @example intervalIntersectionUnix(0, 1000000, 1000000, 2000000) // null (touching)
 * @example intervalIntersectionUnix(0, 1000001, 1000000, 2000000) // { start: 1000000, end: 1000001 }
 * @example intervalIntersectionUnix(NaN, 1700000000, 1000000, 2000000) // null
 * @example intervalIntersectionUnix("0", "1700000000", "1000000", "2000000") // { start: 1000000, end: 2000000 }
 */
export function intervalIntersectionUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): { start: number; end: number } | null {
  const pair = parseUnixEpochIntervalPair(aStart, aEnd, bStart, bEnd);
  // Null unless `aStart < bEnd && bStart < aEnd` (so touching intervals, or an empty interval at
  // an edge, give null); otherwise the latest start and earliest end bound the overlap.
  return pair === null
    ? null
    : halfOpenIntersection(pair[0], pair[1], (left, right) => left - right);
}
