// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { canonicalInstantIntervals } from "../../internal";
import { subtractIntervals } from "../../interval/calculate";
import { isValidUtc } from "../validate";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`. A returned piece ends exactly
 *   where B starts, or starts exactly where B ends, because B's `end` is not in B (CORE-6's
 *   `subtractIntervals`). No piece is stepped by one unit.
 * - B touching A (`bStart === aEnd` or `bEnd === aStart`), or empty, removes nothing.
 * - An empty A (`aStart === aEnd`) has nothing left: returns `[]`. Every returned piece is non-empty.
 * - Delegates to CORE-6's `subtractIntervals` once the arguments pass the UTC-string gate, and
 *   re-serialises the pieces to canonical `Z` strings.
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns A unchanged when B lies entirely before or after it.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, non-`Z` strings, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T13:00:00Z") // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
 * @example intervalDifferenceUtc("2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }] (touching B removes nothing)
 * @example intervalDifferenceUtc("2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z", "2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z") // []
 * @example intervalDifferenceUtc("invalid", "2024-12-31T17:00:00Z", "2024-06-01T12:00:00Z", "2024-07-01T13:00:00Z") // []
 */
export function intervalDifferenceUtc(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): Array<{ start: string; end: string }> {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return [];
  }

  if (
    !isValidUtc(aStart) ||
    !isValidUtc(aEnd) ||
    !isValidUtc(bStart) ||
    !isValidUtc(bEnd)
  ) {
    return [];
  }

  // subtractIntervals returns [] for an invalid (reversed) interval, the same sentinel.
  return (
    canonicalInstantIntervals(
      subtractIntervals({ start: aStart, end: aEnd }, [
        { start: bStart, end: bEnd },
      ]),
    ) ?? []
  );
}
