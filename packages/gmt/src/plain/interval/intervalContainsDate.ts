import { Temporal } from "@js-temporal/polyfill";
import {
  halfOpenContainsPoint,
  halfOpenContainsSpan,
  parseCalendarDateValue,
} from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return true when `pointOrStart` lies in the half-open interval `[intervalStart, intervalEnd)`
 * (3-arg), or when the inner interval `[innerStart, innerEnd)` lies within it (4-arg).
 *
 * - Half-open: an interval holds every day `t` with `start <= t < end`, so `intervalEnd` itself is
 *   outside (the rule CORE-6's `intervalContains` uses). An empty interval (`start === end`)
 *   contains no point.
 * - 4-arg: the inner interval must start at or after `intervalStart`, end at or before
 *   `intervalEnd`, and overlap the outer interval. An empty inner interval therefore counts only
 *   strictly inside, never at an edge (CORE-6's `clampInterval` clamps it away there).
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 * - Accepts RFC 9557 calendar-annotated PlainDate strings — E5 (issue #78). Ordering is
 *   calendar-independent, so arguments may carry different or no calendar tags (D4).
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, `[u-ca=<id>]`, canonical
 *   calendar ids); see `isValidCalendarDate`.
 *
 * @param intervalStart ISO 8601 date string for the outer interval start, optionally calendar-annotated
 * @param intervalEnd ISO 8601 date string for the outer interval end (excluded), optionally calendar-annotated
 * @param pointOrStart ISO 8601 date string for the point (3-arg) or inner start (4-arg), optionally calendar-annotated
 * @param pointEnd optional ISO 8601 date string for the inner interval end (4-arg mode), optionally calendar-annotated
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15") // true
 * @example intervalContainsDate("2024-01-01", "2024-12-31", "2024-12-30") // true (last value before the end)
 * @example intervalContainsDate("2024-01-01", "2024-12-31", "2024-12-31") // false (end is excluded)
 * @example intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15", "2024-12-31") // true (inner shares the end)
 * @example intervalContainsDate("2024-01-01", "2024-12-31", "2024-12-31", "2024-12-31") // false (empty interval at the edge)
 * @example intervalContainsDate("2024-12-31", "2024-01-01", "2024-06-15") // false (reversed interval)
 */
export function intervalContainsDate(
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

  if (
    !isValidCalendarDate(intervalStart) ||
    !isValidCalendarDate(intervalEnd) ||
    !isValidCalendarDate(pointOrStart) ||
    (pointEnd !== undefined && !isValidCalendarDate(pointEnd))
  ) {
    return false;
  }

  try {
    const s = parseCalendarDateValue(intervalStart);
    const e = parseCalendarDateValue(intervalEnd);
    const p = parseCalendarDateValue(pointOrStart);

    if (Temporal.PlainDate.compare(s, e) > 0) {
      return false;
    }

    if (pointEnd === undefined) {
      return halfOpenContainsPoint(
        { start: s, end: e },
        p,
        Temporal.PlainDate.compare,
      );
    }

    const pe = parseCalendarDateValue(pointEnd);

    if (Temporal.PlainDate.compare(p, pe) > 0) {
      return false;
    }

    return halfOpenContainsSpan(
      { start: s, end: e },
      { start: p, end: pe },
      Temporal.PlainDate.compare,
    );
  } catch {
    return false;
  }
}
