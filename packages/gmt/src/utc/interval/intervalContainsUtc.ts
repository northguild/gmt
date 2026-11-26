import { Temporal } from "../../internal/temporal";
import { halfOpenContainsSpan } from "../../internal";
import { utcIntervalOf } from "../../internal/intervalChecks";
import { utcInstantOf } from "../../internal/utcInstant";

/**
 * Return true when `pointOrStart` lies in the half-open interval `[intervalStart, intervalEnd)`
 * (3-arg), or when the inner interval `[innerStart, innerEnd)` lies within it (4-arg).
 *
 * - Half-open: an interval holds every instant `t` with `start <= t < end`, so `intervalEnd` itself is
 *   outside (the rule CORE-6's `intervalContains` uses). An empty interval (`start === end`)
 *   contains no point.
 * - 4-arg: the inner interval must start at or after `intervalStart`, end at or before
 *   `intervalEnd`, and overlap the outer interval. An empty inner interval therefore counts only
 *   strictly inside, never at an edge (CORE-6's `clampInterval` clamps it away there).
 * - The 3-argument form delegates to CORE-6's `intervalContains` once the arguments pass the
 *   UTC-string gate.
 * - Uses `Temporal.Instant.compare` for comparison.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (wrong type, non-`Z` strings, malformed strings, leap seconds).
 *
 * @param intervalStart ISO 8601 UTC datetime string for the outer interval start
 * @param intervalEnd ISO 8601 UTC datetime string for the outer interval end (excluded)
 * @param pointOrStart ISO 8601 UTC datetime string for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional ISO 8601 UTC datetime string for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T12:00:00Z") // true
 * @example intervalContainsUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T16:59:59.999999999Z") // true (last value before the end)
 * @example intervalContainsUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T17:00:00Z") // false (end is excluded)
 * @example intervalContainsUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // true (inner shares the end)
 * @example intervalContainsUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T17:00:00Z") // false (empty interval at the edge)
 * @example intervalContainsUtc("2024-01-01T17:00:00Z", "2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z") // false (reversed interval)
 */
export function intervalContainsUtc(
  intervalStart: string,
  intervalEnd: string,
  pointOrStart: string,
  pointEnd?: string,
): boolean {
  if (
    typeof intervalStart !== "string" ||
    typeof intervalEnd !== "string" ||
    typeof pointOrStart !== "string" ||
    (pointEnd !== undefined && typeof pointEnd !== "string")
  ) {
    return false;
  }

  const outer = utcIntervalOf(intervalStart, intervalEnd);
  if (outer === null) {
    return false;
  }

  if (pointEnd === undefined) {
    const point = utcInstantOf(pointOrStart);
    if (point === null) {
      return false;
    }

    try {
      return (
        Temporal.Instant.compare(outer[0], point) <= 0 &&
        Temporal.Instant.compare(point, outer[1]) < 0
      );
    } catch {
      return false;
    }
  }

  const inner = utcIntervalOf(pointOrStart, pointEnd);
  if (inner === null) {
    return false;
  }

  try {
    return halfOpenContainsSpan(
      { start: outer[0], end: outer[1] },
      { start: inner[0], end: inner[1] },
      Temporal.Instant.compare,
    );
  } catch {
    return false;
  }
}
