import { closedXorSweep, parseUnixEpochIntervalList } from "../../internal";

/**
 * Return the symmetric difference across a list of Unix epoch intervals — the set of epoch
 * values covered by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorUnix`, which is pairwise only.
 * - Implemented as a closed-interval coverage sweep: each interval opens at its start and closes
 *   at its end, and the result is every maximal run where the coverage count is odd. No boundary
 *   is computed past an end. For two overlapping intervals this reduces to exactly
 *   `intervalXorUnix`'s pairwise result.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list, and `[]` when every value is covered an even number of
 *   times (e.g. two identical intervals cancel out).
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of safe-integer (or numeric-string) values — fractions, empty
 *   strings and values beyond ±(2^53 − 1) are invalid — or when any element has `start > end`.
 *
 * @param intervals array of `{ start, end }` records
 * @returns array of `{ start, end }` records covered an odd number of times, or `[]` on invalid input
 *
 * @example intervalXorAllUnix([{ start: 0, end: 1500000000 }, { start: 1400000000, end: 1700000000 }]) // [{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }]
 * @example intervalXorAllUnix([]) // []
 */
export function intervalXorAllUnix(
  intervals: Array<{ start: number | string; end: number | string }>,
): Array<{ start: number; end: number }> {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return [];
  }

  const parsed = parseUnixEpochIntervalList(intervals);

  if (parsed === null) {
    return [];
  }

  return closedXorSweep(parsed, {
    compare: (left, right) => left - right,
    stepUp: (value) => value + 1,
    stepDown: (value) => value - 1,
  });
}
