// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { halfOpenMerge, parseUnixEpochIntervalList } from "../../internal";

/**
 * Collapse a list of Unix epoch intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionUnix`, which is pairwise only.
 * - Intervals are half-open `[start, end)`, the same rule as `mergeIntervals`. They are merged
 *   when they overlap or touch (one's `end` equals the other's `start`), so the runs returned
 *   never touch.
 * - An empty interval (`start === end`) holds no instant: it is absorbed when it touches or lies
 *   inside a run and dropped otherwise, so it never bridges a gap. A list of only empty intervals
 *   returns `[]`, the same value as invalid input — use `isValidUnixInterval` to tell them apart.
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list.
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of safe-integer (or numeric-string) values — fractions, empty
 *   strings and values beyond ±(2^53 − 1) are invalid — or when any element has `start > end`.
 *
 * @param intervals array of `{ start, end }` records
 * @returns the minimum set of non-overlapping `{ start, end }` records, sorted by start, or `[]` on invalid input
 *
 * @example mergeIntervalsUnix([{ start: 0, end: 1000000 }, { start: 500000, end: 1500000 }]) // [{ start: 0, end: 1500000 }]
 * @example mergeIntervalsUnix([{ start: 0, end: 1000000 }, { start: 1000000, end: 2000000 }]) // [{ start: 0, end: 2000000 }] (touching)
 * @example mergeIntervalsUnix([{ start: 5, end: 5 }]) // [] (an empty interval holds no instant)
 * @example mergeIntervalsUnix([]) // []
 */
export function mergeIntervalsUnix(
  intervals: Array<{ start: number | string; end: number | string }>,
): Array<{ start: number; end: number }> {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return [];
  }

  const parsed = parseUnixEpochIntervalList(intervals);

  if (parsed === null) {
    return [];
  }

  // Sorted, disjoint, non-touching, non-empty runs.
  return halfOpenMerge(parsed, (left, right) => left - right);
}
