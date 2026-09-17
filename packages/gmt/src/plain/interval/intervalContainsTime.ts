import { Temporal } from "@js-temporal/polyfill";
import { halfOpenContainsPoint, halfOpenContainsSpan } from "../../internal";
import { isValidTime } from "../validate";

/**
 * Return true when `pointOrStart` lies in the half-open interval `[intervalStart, intervalEnd)`
 * (3-arg), or when the inner interval `[innerStart, innerEnd)` lies within it (4-arg).
 *
 * - Half-open: an interval holds every clock time `t` with `start <= t < end`, so `intervalEnd` itself is
 *   outside (the rule CORE-6's `intervalContains` uses). An empty interval (`start === end`)
 *   contains no point.
 * - 4-arg: the inner interval must start at or after `intervalStart`, end at or before
 *   `intervalEnd`, and overlap the outer interval. An empty inner interval therefore counts only
 *   strictly inside, never at an edge (CORE-6's `clampInterval` clamps it away there).
 * - PlainTime has no day rollover: an interval never wraps past midnight, and because `end` is
 *   excluded no interval holds `23:59:59.999999999` as its end.
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param intervalStart ISO 8601 time string for the outer interval start
 * @param intervalEnd ISO 8601 time string for the outer interval end (excluded)
 * @param pointOrStart ISO 8601 time string for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional ISO 8601 time string for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsTime("09:00:00", "17:00:00", "12:00:00") // true
 * @example intervalContainsTime("09:00:00", "17:00:00", "16:59:59.999999999") // true (last value before the end)
 * @example intervalContainsTime("09:00:00", "17:00:00", "17:00:00") // false (end is excluded)
 * @example intervalContainsTime("09:00:00", "17:00:00", "12:00:00", "17:00:00") // true (inner shares the end)
 * @example intervalContainsTime("09:00:00", "17:00:00", "17:00:00", "17:00:00") // false (empty interval at the edge)
 * @example intervalContainsTime("17:00:00", "09:00:00", "12:00:00") // false (reversed interval)
 */
export function intervalContainsTime(
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
    !isValidTime(intervalStart) ||
    !isValidTime(intervalEnd) ||
    !isValidTime(pointOrStart) ||
    (pointEnd !== undefined && !isValidTime(pointEnd))
  ) {
    return false;
  }

  try {
    const s = Temporal.PlainTime.from(intervalStart);
    const e = Temporal.PlainTime.from(intervalEnd);
    const p = Temporal.PlainTime.from(pointOrStart);

    if (Temporal.PlainTime.compare(s, e) > 0) {
      return false;
    }

    if (pointEnd === undefined) {
      return halfOpenContainsPoint(
        { start: s, end: e },
        p,
        Temporal.PlainTime.compare,
      );
    }

    const pe = Temporal.PlainTime.from(pointEnd);

    if (Temporal.PlainTime.compare(p, pe) > 0) {
      return false;
    }

    return halfOpenContainsSpan(
      { start: s, end: e },
      { start: p, end: pe },
      Temporal.PlainTime.compare,
    );
  } catch {
    return false;
  }
}
