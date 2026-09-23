import {
  halfOpenContainsSpan,
  parseUnixEpochIntervalPair,
} from "../../internal";

/**
 * Return true when the half-open interval B `[bStart, bEnd)` lies within the half-open interval
 * A `[aStart, aEnd)` — every instant of B falls within A.
 *
 * - Compares numeric Unix epoch values directly.
 * - B is inside A when the intervals overlap and `aStart <= bStart` and `bEnd <= aEnd`. Both ends
 *   are exclusive, so B may start at A's start and end at A's end.
 * - An empty B counts only strictly inside A, the same edge rule as `clampInterval`; at either edge
 *   of A it returns `false`, and an empty A engulfs nothing.
 * - Equivalent to 4-argument `intervalContainsUnix(aStart, aEnd, bStart, bEnd)`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input: non-numeric types, empty strings, and values that are not
 *   safe integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — outer interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — outer interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — inner interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — inner interval end
 * @returns true if B is fully contained in A, or false on invalid input
 *
 * @example intervalEngulfsUnix(0, 1700000000, 1500000000, 1600000000) // true
 * @example intervalEngulfsUnix(0, 1700000000, 0, 1700000000) // true (equal intervals)
 * @example intervalEngulfsUnix(0, 1700000000, 0, 1500000000) // true
 * @example intervalEngulfsUnix(0, 1700000000, 1700000000, 1700000000) // false (empty B at A's end)
 * @example intervalEngulfsUnix(1500000000, 1600000000, 0, 1700000000) // false
 * @example intervalEngulfsUnix(NaN, 1700000000, 1500000000, 1600000000) // false
 */
export function intervalEngulfsUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): boolean {
  const pair = parseUnixEpochIntervalPair(aStart, aEnd, bStart, bEnd);

  // B overlaps A, and B's start and exclusive end both lie within A's bounds.
  return (
    pair !== null &&
    halfOpenContainsSpan(pair[0], pair[1], (left, right) => left - right)
  );
}
