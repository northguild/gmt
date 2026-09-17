import { parseIntervalNanoseconds } from "../../internal";
import type { Interval } from "../../types";

/**
 * Return true when two half-open intervals share at least one instant.
 *
 * - `a.start < b.end && b.start < a.end`. Touching intervals (`a.end` is `b.start`) do not
 *   overlap: under `[start, end)` the shared endpoint belongs only to the later interval.
 * - True exactly when `intersectIntervals(a, b)` is not `null`.
 * - An empty interval (`start === end`) overlaps an interval it lies strictly inside, and nothing
 *   else — not at an edge, not another empty interval at the same instant (GMT rule: an empty
 *   interval covers no time, so only a strictly interior position is shared).
 * - Compares instants: endpoints may name different zones.
 * - The positional `intervalsOverlapUtc`, `intervalsOverlapZoned`, `intervalsOverlapDate` (…)
 *   follow the same half-open rule, so touching intervals do not overlap there either.
 * - For zone-aligned windows (a local day, a trading session), build the endpoints with
 *   `floorToZone` first.
 * - Returns `false` on invalid input — either interval not an `Interval`, or inverted.
 *
 * @param a `{ start, end }` record of ISO 8601 instant strings
 * @param b `{ start, end }` record of ISO 8601 instant strings
 * @returns true if the intervals share an instant, or false on invalid input
 *
 * @example intervalsOverlap({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }) // true
 * @example intervalsOverlap({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" }) // false — touching
 * @example intervalsOverlap({ start: "2024-01-01T12:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // true — empty, strictly inside
 * @example intervalsOverlap({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T09:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // false — empty, at the edge
 * @example intervalsOverlap({ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // false — inverted
 */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  const first = parseIntervalNanoseconds(a);
  const second = parseIntervalNanoseconds(b);

  if (first === null || second === null) {
    return false;
  }

  return first.start < second.end && second.start < first.end;
}
