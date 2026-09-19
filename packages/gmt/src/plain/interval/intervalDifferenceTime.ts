// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenDifference } from "../../internal";
import { isValidTime } from "../validate";

/**
 * Return the portion(s) of interval A not covered by interval B.
 *
 * - Uses `Temporal.PlainTime.compare` for comparison.
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
 * @param aStart ISO 8601 time string for the first interval start
 * @param aEnd ISO 8601 time string for the first interval end
 * @param bStart ISO 8601 time string for the second interval start
 * @param bEnd ISO 8601 time string for the second interval end
 * @returns array of `{ start, end }` records representing A minus B, or `[]` on invalid input
 *
 * @example intervalDifferenceTime("09:00:00", "17:00:00", "12:00:00", "13:00:00") // [{ start: "09:00:00", end: "12:00:00" }, { start: "13:00:00", end: "17:00:00" }]
 * @example intervalDifferenceTime("09:00:00", "17:00:00", "09:00:00", "17:00:00") // []
 * @example intervalDifferenceTime("09:00:00", "17:00:00", "12:00:00", "17:00:00") // [{ start: "09:00:00", end: "12:00:00" }]
 * @example intervalDifferenceTime("12:00:00", "17:00:00", "09:00:00", "12:00:00") // [{ start: "12:00:00", end: "17:00:00" }] (touching B removes nothing)
 * @example intervalDifferenceTime("invalid", "17:00:00", "12:00:00", "13:00:00") // []
 */
export function intervalDifferenceTime(
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
    !isValidTime(aStart) ||
    !isValidTime(aEnd) ||
    !isValidTime(bStart) ||
    !isValidTime(bEnd)
  ) {
    return [];
  }

  try {
    const aS = Temporal.PlainTime.from(aStart);
    const aE = Temporal.PlainTime.from(aEnd);
    const bS = Temporal.PlainTime.from(bStart);
    const bE = Temporal.PlainTime.from(bEnd);

    if (Temporal.PlainTime.compare(aS, aE) > 0) {
      return [];
    }

    if (Temporal.PlainTime.compare(bS, bE) > 0) {
      return [];
    }

    return halfOpenDifference(
      { start: aS, end: aE },
      [{ start: bS, end: bE }],
      Temporal.PlainTime.compare,
    ).map(({ start, end }) => ({
      start: start.toString(),
      end: end.toString(),
    }));
  } catch {
    return [];
  }
}
