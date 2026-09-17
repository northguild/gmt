// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenDifference } from "../../internal";
import { isValidDateTime } from "../validate";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Half-open: an interval holds every `t` with `start <= t < end`. A returned piece ends exactly
 *   where B starts, or starts exactly where B ends, because B's `end` is not in B (CORE-6's
 *   `subtractIntervals`). No piece is stepped by one unit.
 * - B touching A (`bStart === aEnd` or `bEnd === aStart`), or empty, removes nothing.
 * - An empty A (`aStart === aEnd`) has nothing left: returns `[]`. Every returned piece is non-empty.
 * - Returns `[]` when B fully covers A.
 * - Returns `[{ start, end }]` when B overlaps one edge of A (or equals A).
 * - Returns `[{ start, end }, { start, end }]` when B is fully inside A with gaps on both sides.
 * - Returns A unchanged when B lies entirely before or after it.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T12:00:00", "2024-01-01T13:00:00") // [{ start: "2024-01-01T09:00:00", end: "2024-01-01T12:00:00" }, { start: "2024-01-01T13:00:00", end: "2024-01-01T17:00:00" }]
 * @example intervalDifferenceDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T09:00:00", "2024-01-01T17:00:00") // []
 * @example intervalDifferenceDateTime("invalid", "2024-12-31T17:00:00", "2024-06-01T12:00:00", "2024-07-01T13:00:00") // []
 */
export function intervalDifferenceDateTime(
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
    !isValidDateTime(aStart) ||
    !isValidDateTime(aEnd) ||
    !isValidDateTime(bStart) ||
    !isValidDateTime(bEnd)
  ) {
    return [];
  }

  try {
    const aS = Temporal.PlainDateTime.from(aStart);
    const aE = Temporal.PlainDateTime.from(aEnd);
    const bS = Temporal.PlainDateTime.from(bStart);
    const bE = Temporal.PlainDateTime.from(bEnd);

    if (Temporal.PlainDateTime.compare(aS, aE) > 0) {
      return [];
    }

    if (Temporal.PlainDateTime.compare(bS, bE) > 0) {
      return [];
    }

    return halfOpenDifference(
      { start: aS, end: aE },
      [{ start: bS, end: bE }],
      Temporal.PlainDateTime.compare,
    ).map(({ start, end }) => ({
      start: start.toString(),
      end: end.toString(),
    }));
  } catch {
    return [];
  }
}
