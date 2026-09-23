// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { halfOpenXor, parseUnixEpochIntervalList } from "../../internal";

/**
 * Return the symmetric difference across a list of Unix epoch intervals — the set of epoch
 * values covered by an odd number of the input intervals.
 *
 * - List-form generalization of `intervalXorUnix`, which is pairwise only.
 * - Intervals are half-open `[start, end)`. The result is every maximal run where the coverage
 *   count is odd, so touching runs join and an empty interval (`start === end`) changes nothing.
 *   Every boundary is an input's own `start` or `end`; none is stepped by an epoch unit. For two
 *   intervals this is exactly `intervalXorUnix`'s pairwise result.
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
 * @example intervalXorAllUnix([{ start: 0, end: 1500000000 }, { start: 1400000000, end: 1700000000 }]) // [{ start: 0, end: 1400000000 }, { start: 1500000000, end: 1700000000 }]
 * @example intervalXorAllUnix([{ start: 0, end: 5 }, { start: 5, end: 10 }]) // [{ start: 0, end: 10 }] (touching runs join)
 * @example intervalXorAllUnix([]) // []
 */
export function intervalXorAllUnix(
  intervals: Array<{ start: number | string; end: number | string }>,
): Array<{ start: number; end: number }> {
  try {
    if (!Array.isArray(intervals) || intervals.length === 0) {
      return [];
    }

    const parsed = parseUnixEpochIntervalList(intervals);

    if (parsed === null) {
      return [];
    }

    return halfOpenXor(parsed, (left, right) => left - right);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
