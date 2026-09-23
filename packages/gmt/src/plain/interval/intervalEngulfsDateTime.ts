// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenContainsSpan } from "../../internal";
import { isValidDateTime } from "../validate";

/**
 * Return true when the half-open interval B `[bStart, bEnd)` lies within the half-open interval
 * A `[aStart, aEnd)` — every moment of B is also in A.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`. B may start at A's start and
 *   end at A's end, because neither end is part of either interval.
 * - B must also overlap A, so an empty B (`bStart === bEnd`) counts only strictly inside A, never
 *   at an edge (CORE-6's `clampInterval` clamps it away there).
 * - Equivalent to 4-argument `intervalContainsDateTime(aStart, aEnd, bStart, bEnd)`.
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the outer interval start
 * @param aEnd ISO 8601 datetime string for the outer interval end (excluded)
 * @param bStart ISO 8601 datetime string for the inner interval start
 * @param bEnd ISO 8601 datetime string for the inner interval end (excluded)
 * @returns true if B lies within A, or false on invalid input
 *
 * @example intervalEngulfsDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T12:00:00", "2024-01-01T13:00:00") // true
 * @example intervalEngulfsDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T09:00:00", "2024-01-01T17:00:00") // true (equal intervals)
 * @example intervalEngulfsDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // true (same end)
 * @example intervalEngulfsDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00") // true (empty interval strictly inside)
 * @example intervalEngulfsDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T17:00:00", "2024-01-01T17:00:00") // false (empty interval at the edge)
 * @example intervalEngulfsDateTime("2024-01-01T12:00:00", "2024-01-01T13:00:00", "2024-01-01T09:00:00", "2024-01-01T17:00:00") // false
 */
export function intervalEngulfsDateTime(
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
    !isValidDateTime(aStart) ||
    !isValidDateTime(aEnd) ||
    !isValidDateTime(bStart) ||
    !isValidDateTime(bEnd)
  ) {
    return false;
  }

  try {
    const aS = Temporal.PlainDateTime.from(aStart);
    const aE = Temporal.PlainDateTime.from(aEnd);
    const bS = Temporal.PlainDateTime.from(bStart);
    const bE = Temporal.PlainDateTime.from(bEnd);

    if (Temporal.PlainDateTime.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.PlainDateTime.compare(bS, bE) > 0) {
      return false;
    }

    return halfOpenContainsSpan(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainDateTime.compare,
    );
  } catch {
    return false;
  }
}
