import {
  coalesceIntervalNanoseconds,
  parseIntervalNanosecondsList,
} from "../../internal";
import type { Interval } from "../../types";

/**
 * Collapse a list of half-open intervals into the fewest sorted, non-overlapping intervals.
 *
 * - Overlapping and touching intervals (`a.end` is `b.start`) coalesce: `[09, 12) ∪ [12, 17)`
 *   is `[09, 17)`. Intervals one nanosecond apart do not.
 * - Input order does not matter; the result is sorted by start, and no two results touch.
 * - Empty intervals (`start === end`) cover no time: one that touches or lies inside a run is
 *   absorbed, one that touches nothing is dropped (GMT rule).
 * - Endpoints are the caller's own strings. A run keeps the start of its first interval (by
 *   instant, then input order) and the end of the first interval to reach its latest end
 *   (GMT rule: first wins ties between spellings of one instant).
 * - `[]` is both a legitimate result (an empty list, or a list of only empty intervals) and the
 *   invalid-input sentinel; check inputs with `isValidInterval` when the difference matters.
 * - The positional `mergeIntervalsUtc`, `mergeIntervalsZoned` (…) follow the same half-open rule
 *   and re-serialise endpoints instead of echoing the caller's strings.
 * - Returns `[]` when `intervals` is not an array or any element is not a valid `Interval`.
 *
 * @param intervals array of `{ start, end }` records of ISO 8601 instant strings
 * @returns sorted, disjoint, non-touching `{ start, end }` records, or [] on invalid input
 *
 * @example mergeIntervals([{ start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
 * @example mergeIntervals([{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }] — touching
 * @example mergeIntervals([{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T10:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }]) // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T10:00:00Z" }] — stranded empty dropped
 * @example mergeIntervals([]) // []
 * @example mergeIntervals([{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }]) // [] — inverted
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const records = parseIntervalNanosecondsList(intervals);

  if (records === null) {
    return [];
  }

  return coalesceIntervalNanoseconds(records).map((run) => ({
    start: run.startText,
    end: run.endText,
  }));
}
