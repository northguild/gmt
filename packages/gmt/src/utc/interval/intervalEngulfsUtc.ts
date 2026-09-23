// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenContainsSpan } from "../../internal";
import { isValidUtc } from "../validate";

/**
 * Return true when the half-open interval B `[bStart, bEnd)` lies within the half-open interval
 * A `[aStart, aEnd)` — every instant of B is also in A.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`. B may start at A's start and
 *   end at A's end, because neither end is part of either interval.
 * - B must also overlap A, so an empty B (`bStart === bEnd`) counts only strictly inside A, never
 *   at an edge (CORE-6's `clampInterval` clamps it away there).
 * - Equivalent to 4-argument `intervalContainsUtc(aStart, aEnd, bStart, bEnd)`.
 * - Uses `Temporal.Instant.compare` for comparison.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, non-`Z` strings, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the outer interval start
 * @param aEnd ISO 8601 UTC datetime string for the outer interval end (excluded)
 * @param bStart ISO 8601 UTC datetime string for the inner interval start
 * @param bEnd ISO 8601 UTC datetime string for the inner interval end (excluded)
 * @returns true if B lies within A, or false on invalid input
 *
 * @example intervalEngulfsUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T13:00:00Z") // true
 * @example intervalEngulfsUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z") // true (equal intervals)
 * @example intervalEngulfsUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // true (same end)
 * @example intervalEngulfsUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00Z") // true (empty interval strictly inside)
 * @example intervalEngulfsUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T17:00:00Z") // false (empty interval at the edge)
 * @example intervalEngulfsUtc("2024-01-01T12:00:00Z", "2024-01-01T13:00:00Z", "2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z") // false
 */
export function intervalEngulfsUtc(
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
    !isValidUtc(aStart) ||
    !isValidUtc(aEnd) ||
    !isValidUtc(bStart) ||
    !isValidUtc(bEnd)
  ) {
    return false;
  }

  try {
    const aS = Temporal.Instant.from(aStart);
    const aE = Temporal.Instant.from(aEnd);
    const bS = Temporal.Instant.from(bStart);
    const bE = Temporal.Instant.from(bEnd);

    if (Temporal.Instant.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.Instant.compare(bS, bE) > 0) {
      return false;
    }

    return halfOpenContainsSpan(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.Instant.compare,
    );
  } catch {
    return false;
  }
}
