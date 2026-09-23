import { halfOpenUnion, parseUnixEpochIntervalPair } from "../../internal";

/**
 * Return the combined span of two half-open Unix epoch intervals `[start, end)`, or null when
 * their union is not one non-empty span.
 *
 * - Compares numeric Unix epoch values directly.
 * - The result is the single run `mergeIntervalsUnix([a, b])` produces, the same rule as
 *   `mergeIntervals`. Overlapping intervals return their merged span.
 * - Touching intervals (e.g. `aEnd === bStart`) leave no gap between them and ARE merged.
 * - An empty interval (`start === end`) holds no instant, so it never changes the result: with a
 *   non-empty interval the answer is that interval, and two empty intervals give `null`.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input: non-numeric types, empty strings, and values that are not
 *   safe integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — first interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — first interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — second interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — second interval end
 * @returns `{ start, end }` with the merged span, or null on invalid input / disjoint intervals
 *
 * @example intervalUnionUnix(0, 1700000000, 1000000, 2000000) // { start: 0, end: 1700000000 }
 * @example intervalUnionUnix(0, 1000000, 1000000, 2000000) // { start: 0, end: 2000000 } (touching)
 * @example intervalUnionUnix(0, 1000000, 3000000, 3000000) // { start: 0, end: 1000000 } (an empty interval adds nothing)
 * @example intervalUnionUnix(0, 1000000, 1000001, 2000000) // null
 * @example intervalUnionUnix(NaN, 1700000000, 1000000, 2000000) // null
 * @example intervalUnionUnix("0", "1700000000", "1000000", "2000000") // { start: 0, end: 1700000000 }
 */
export function intervalUnionUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): { start: number; end: number } | null {
  const pair = parseUnixEpochIntervalPair(aStart, aEnd, bStart, bEnd);

  if (pair === null) {
    return null;
  }

  // One merged run, or null when a gap (or no instant at all) leaves no single span.
  return halfOpenUnion(pair[0], pair[1], (left, right) => left - right);
}
