// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenContainsSpan, parseCalendarDateValue } from "../../internal";
import { isValidCalendarDate } from "../validate";

/**
 * Return true when the half-open interval B `[bStart, bEnd)` lies within the half-open interval
 * A `[aStart, aEnd)` — every day of B is also in A.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`. B may start at A's start and
 *   end at A's end, because neither end is part of either interval.
 * - B must also overlap A, so an empty B (`bStart === bEnd`) counts only strictly inside A, never
 *   at an edge (CORE-6's `clampInterval` clamps it away there).
 * - Equivalent to 4-argument `intervalContainsDate(aStart, aEnd, bStart, bEnd)`.
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 * - Accepts RFC 9557 calendar-annotated PlainDate strings — E5 (issue #78). Ordering is
 *   calendar-independent, so arguments may carry different or no calendar tags (D4).
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, `[u-ca=<id>]`, canonical
 *   calendar ids); see `isValidCalendarDate`.
 *
 * @param aStart ISO 8601 date string for the outer interval start, optionally calendar-annotated
 * @param aEnd ISO 8601 date string for the outer interval end (excluded), optionally calendar-annotated
 * @param bStart ISO 8601 date string for the inner interval start, optionally calendar-annotated
 * @param bEnd ISO 8601 date string for the inner interval end (excluded), optionally calendar-annotated
 * @returns true if B lies within A, or false on invalid input
 *
 * @example intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01") // true
 * @example intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31") // true (equal intervals)
 * @example intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-12-31") // true (same end)
 * @example intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-06-01") // true (empty interval strictly inside)
 * @example intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-12-31", "2024-12-31") // false (empty interval at the edge)
 * @example intervalEngulfsDate("2024-06-01", "2024-07-01", "2024-01-01", "2024-12-31") // false
 */
export function intervalEngulfsDate(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return false;
  }

  if (
    !isValidCalendarDate(aStart) ||
    !isValidCalendarDate(aEnd) ||
    !isValidCalendarDate(bStart) ||
    !isValidCalendarDate(bEnd)
  ) {
    return false;
  }

  try {
    const aS = parseCalendarDateValue(aStart);
    const aE = parseCalendarDateValue(aEnd);
    const bS = parseCalendarDateValue(bStart);
    const bE = parseCalendarDateValue(bEnd);

    if (Temporal.PlainDate.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.PlainDate.compare(bS, bE) > 0) {
      return false;
    }

    return halfOpenContainsSpan(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainDate.compare,
    );
  } catch {
    return false;
  }
}
