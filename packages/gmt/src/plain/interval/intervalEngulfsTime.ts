// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenContainsSpan } from "../../internal";
import { isValidTime } from "../validate";

/**
 * Return true when the half-open interval B `[bStart, bEnd)` lies within the half-open interval
 * A `[aStart, aEnd)` — every clock time of B is also in A.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`. B may start at A's start and
 *   end at A's end, because neither end is part of either interval.
 * - B must also overlap A, so an empty B (`bStart === bEnd`) counts only strictly inside A, never
 *   at an edge (CORE-6's `clampInterval` clamps it away there).
 * - Equivalent to 4-argument `intervalContainsTime(aStart, aEnd, bStart, bEnd)`.
 * - PlainTime has no day rollover: an interval never wraps past midnight, and because `end` is
 *   excluded no interval holds `23:59:59.999999999` as its end.
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the outer interval start
 * @param aEnd ISO 8601 time string for the outer interval end (excluded)
 * @param bStart ISO 8601 time string for the inner interval start
 * @param bEnd ISO 8601 time string for the inner interval end (excluded)
 * @returns true if B lies within A, or false on invalid input
 *
 * @example intervalEngulfsTime("09:00:00", "17:00:00", "12:00:00", "13:00:00") // true
 * @example intervalEngulfsTime("09:00:00", "17:00:00", "09:00:00", "17:00:00") // true (equal intervals)
 * @example intervalEngulfsTime("09:00:00", "17:00:00", "12:00:00", "17:00:00") // true (same end)
 * @example intervalEngulfsTime("09:00:00", "17:00:00", "12:00:00", "12:00:00") // true (empty interval strictly inside)
 * @example intervalEngulfsTime("09:00:00", "17:00:00", "17:00:00", "17:00:00") // false (empty interval at the edge)
 * @example intervalEngulfsTime("12:00:00", "13:00:00", "09:00:00", "17:00:00") // false
 */
export function intervalEngulfsTime(
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
    !isValidTime(aStart) ||
    !isValidTime(aEnd) ||
    !isValidTime(bStart) ||
    !isValidTime(bEnd)
  ) {
    return false;
  }

  try {
    const aS = Temporal.PlainTime.from(aStart);
    const aE = Temporal.PlainTime.from(aEnd);
    const bS = Temporal.PlainTime.from(bStart);
    const bE = Temporal.PlainTime.from(bEnd);

    if (Temporal.PlainTime.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.PlainTime.compare(bS, bE) > 0) {
      return false;
    }

    return halfOpenContainsSpan(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainTime.compare,
    );
  } catch {
    return false;
  }
}
