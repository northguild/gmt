import { parseUnixEpochIntervalList } from "../../internal";

/**
 * Collapse a list of Unix epoch intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionUnix`, which is pairwise only.
 * - Intervals are merged when they overlap or share an endpoint exactly (adjacent intervals
 *   ARE merged).
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

  parsed.sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];

  for (const interval of parsed) {
    const last = merged[merged.length - 1];

    if (last && interval.start <= last.end) {
      if (interval.end > last.end) {
        last.end = interval.end;
      }
    } else {
      merged.push({ start: interval.start, end: interval.end });
    }
  }

  return merged;
}
