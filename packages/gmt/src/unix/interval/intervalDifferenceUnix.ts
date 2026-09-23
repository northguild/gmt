// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { halfOpenDifference, parseUnixEpochIntervalPair } from "../../internal";

/**
 * Return the portion(s) of the half-open interval A `[aStart, aEnd)` not covered by the half-open
 * interval B `[bStart, bEnd)`.
 *
 * - Compares numeric Unix epoch values directly, with the same rule as `subtractIntervals`.
 * - Every cut lands exactly on B's own `start` or `end`: the piece before B ends at `bStart`, which
 *   it excludes, and the piece after B starts at `bEnd`, which B excludes. No boundary is stepped
 *   by an epoch unit.
 * - Returns `[]` when B fully covers A, and when A is empty (`aStart === aEnd`).
 * - Returns `[{ start, end }]` when B overlaps one edge of A.
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns A unchanged when B lies entirely before or after it, touches it, or is empty.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input: non-numeric types, empty strings, and values that are not safe
 *   integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — first interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — first interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — second interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — second interval end
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceUnix(0, 1700000000, 1500000000, 1600000000) // [{ start: 0, end: 1500000000 }, { start: 1600000000, end: 1700000000 }]
 * @example intervalDifferenceUnix(0, 1500000000, 1500000000, 1700000000) // [{ start: 0, end: 1500000000 }] (touching: B removes nothing)
 * @example intervalDifferenceUnix(0, 1700000000, 0, 1700000000) // []
 * @example intervalDifferenceUnix(NaN, 1700000000, 1500000000, 1600000000) // []
 * @example intervalDifferenceUnix(0, 2, 0.5, 1) // [] (fractional epoch)
 * @example intervalDifferenceUnix(5, 10, 0, 5) // [{ start: 5, end: 10 }] (B ends where A starts)
 */
export function intervalDifferenceUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): Array<{ start: number; end: number }> {
  const pair = parseUnixEpochIntervalPair(aStart, aEnd, bStart, bEnd);

  if (pair === null) {
    return [];
  }

  // The non-empty parts of A before B starts and after B ends; an empty B removes nothing.
  return halfOpenDifference(pair[0], [pair[1]], (left, right) => left - right);
}
