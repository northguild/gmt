import { plainDateTimeOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";
import { halfOpenContainsPoint, halfOpenContainsSpan } from "../../internal";

/**
 * Return true when `pointOrStart` lies in the half-open interval `[intervalStart, intervalEnd)`
 * (3-arg), or when the inner interval `[innerStart, innerEnd)` lies within it (4-arg).
 *
 * - Half-open: an interval holds every moment `t` with `start <= t < end`, so `intervalEnd` itself is
 *   outside (the rule CORE-6's `intervalContains` uses). An empty interval (`start === end`)
 *   contains no point.
 * - 4-arg: the inner interval must start at or after `intervalStart`, end at or before
 *   `intervalEnd`, and overlap the outer interval. An empty inner interval therefore counts only
 *   strictly inside, never at an edge (CORE-6's `clampInterval` clamps it away there).
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param intervalStart ISO 8601 datetime string for the outer interval start
 * @param intervalEnd ISO 8601 datetime string for the outer interval end (excluded)
 * @param pointOrStart ISO 8601 datetime string for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional ISO 8601 datetime string for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T12:00:00") // true
 * @example intervalContainsDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T16:59:59.999999999") // true (last value before the end)
 * @example intervalContainsDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T17:00:00") // false (end is excluded)
 * @example intervalContainsDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // true (inner shares the end)
 * @example intervalContainsDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T17:00:00", "2024-01-01T17:00:00") // false (empty interval at the edge)
 * @example intervalContainsDateTime("2024-01-01T17:00:00", "2024-01-01T09:00:00", "2024-01-01T12:00:00") // false (reversed interval)
 */
export function intervalContainsDateTime(
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

  const s = plainDateTimeOf(intervalStart);
  const e = plainDateTimeOf(intervalEnd);
  const p = plainDateTimeOf(pointOrStart);
  const pe = pointEnd === undefined ? undefined : plainDateTimeOf(pointEnd);
  if (s === null || e === null || p === null || pe === null) {
    return false;
  }

  try {
    if (Temporal.PlainDateTime.compare(s, e) > 0) {
      return false;
    }

    if (pe === undefined) {
      return halfOpenContainsPoint(
        { start: s, end: e },
        p,
        Temporal.PlainDateTime.compare,
      );
    }

    if (Temporal.PlainDateTime.compare(p, pe) > 0) {
      return false;
    }

    return halfOpenContainsSpan(
      { start: s, end: e },
      { start: p, end: pe },
      Temporal.PlainDateTime.compare,
    );
  } catch {
    return false;
  }
}
