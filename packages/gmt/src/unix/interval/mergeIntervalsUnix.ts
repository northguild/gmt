import { isValidUnixEpochPair } from "../../internal/resolveUnixTimeZone";

/**
 * Collapse a list of Unix epoch intervals into the minimum set of non-overlapping intervals.
 *
 * - List-form generalization of `intervalUnionUnix`, which is pairwise only.
 * - Intervals are merged when they overlap or share an endpoint exactly (adjacent intervals
 *   ARE merged).
 * - Order of the input list does not matter; the result is sorted by start.
 * - Returns `[]` for an empty list.
 * - Returns `[]` when `intervals` is not an array, when any element is not a
 *   `{ start, end }` record of finite numeric (or numeric-string) values, or when any element
 *   has `start > end`.
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

  if (
    !intervals.every(
      (interval) =>
        interval &&
        typeof interval === "object" &&
        (typeof interval.start === "number" ||
          typeof interval.start === "string") &&
        (typeof interval.end === "number" || typeof interval.end === "string"),
    )
  ) {
    return [];
  }

  const parsed = intervals.map((interval) => ({
    start:
      typeof interval.start === "number"
        ? interval.start
        : Number(interval.start),
    end: typeof interval.end === "number" ? interval.end : Number(interval.end),
  }));

  if (
    !parsed.every(
      (interval) =>
        isValidUnixEpochPair(interval.start, interval.end) &&
        interval.start <= interval.end,
    )
  ) {
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
