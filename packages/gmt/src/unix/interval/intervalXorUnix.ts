// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { halfOpenXor, parseUnixEpochIntervalPair } from "../../internal";

/**
 * Return the symmetric difference of two half-open Unix intervals `[start, end)` — the values
 * covered by exactly one interval.
 *
 * - Compares numeric Unix epoch values directly.
 * - The result is every maximal run covered by exactly one interval, sorted by start — the same
 *   as `mergeIntervals` of `subtractIntervals(a, [b])` and `subtractIntervals(b, [a])`, and the
 *   same as `intervalXorAllUnix([a, b])`.
 * - Every boundary is an input's own `start` or `end`; no boundary is stepped by an epoch unit.
 * - Touching intervals share no value, so they join into one run (`[0, 5)` xor `[5, 10)` is
 *   `[0, 10)`). An empty interval (`start === end`) holds no value and changes nothing.
 * - Returns `[]` when the intervals are identical.
 * - Returns `[{ start, end }]` when the intervals share a start or an end, or touch.
 * - Returns `[{ start, end }, { start, end }]` when they partially overlap, when one strictly
 *   contains the other, or when they are disjoint with a gap.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input: non-numeric types, empty strings, and values that are not safe
 *   integers (fractions, `NaN`, `±Infinity`, beyond ±(2^53 − 1)).
 *
 * @param aStart Unix epoch value, in the one unit all epoch arguments share — first interval start
 * @param aEnd Unix epoch value, in the one unit all epoch arguments share — first interval end
 * @param bStart Unix epoch value, in the one unit all epoch arguments share — second interval start
 * @param bEnd Unix epoch value, in the one unit all epoch arguments share — second interval end
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input
 *
 * @example intervalXorUnix(0, 1500000000, 1400000000, 1700000000) // [{ start: 0, end: 1400000000 }, { start: 1500000000, end: 1700000000 }]
 * @example intervalXorUnix(0, 1700000000, 1400000000, 1500000000) // [{ start: 0, end: 1400000000 }, { start: 1500000000, end: 1700000000 }]
 * @example intervalXorUnix(0, 1500000000, 1500000000, 1700000000) // [{ start: 0, end: 1700000000 }] (touching intervals join)
 * @example intervalXorUnix(0, 1700000000, 0, 1700000000) // []
 * @example intervalXorUnix(NaN, 1500000000, 1400000000, 1700000000) // []
 * @example intervalXorUnix(0, 1, 0.5, 2) // [] (fractional epoch)
 */
export function intervalXorUnix(
  aStart: number | string,
  aEnd: number | string,
  bStart: number | string,
  bEnd: number | string,
): Array<{ start: number; end: number }> {
  const pair = parseUnixEpochIntervalPair(aStart, aEnd, bStart, bEnd);

  if (pair === null) {
    return [];
  }

  // Maximal runs covered an odd number of times (exactly once, for two intervals).
  return halfOpenXor(pair, (left, right) => left - right);
}
