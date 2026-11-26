// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { plainTimeOf } from "../../internal/inputChecks";
import { Temporal } from "../../internal/temporal";
import { halfOpenXor } from "../../internal";

/**
 * Return the symmetric difference of two time intervals — time covered by exactly one interval.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`. The result is every maximal
 *   run covered by exactly one of the two intervals, sorted by start — the same set as
 *   CORE-6's `mergeIntervals([...subtractIntervals(a, [b]), ...subtractIntervals(b, [a])])`.
 * - Pieces end exactly where the other interval starts; no piece is stepped by one nanosecond.
 * - Touching intervals (`aEnd === bStart`) share nothing, so they return one combined run.
 * - Returns `[]` when the intervals are identical. An empty interval contributes nothing.
 * - Returns `[]` if either interval is invalid (`start > end`).
 * - Returns `[]` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the first interval start
 * @param aEnd ISO 8601 time string for the first interval end
 * @param bStart ISO 8601 time string for the second interval start
 * @param bEnd ISO 8601 time string for the second interval end
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input
 *
 * @example intervalXorTime("09:00:00", "12:00:00", "11:00:00", "17:00:00") // [{ start: "09:00:00", end: "11:00:00" }, { start: "12:00:00", end: "17:00:00" }]
 * @example intervalXorTime("09:00:00", "12:00:00", "12:00:00", "17:00:00") // [{ start: "09:00:00", end: "17:00:00" }] (touching)
 * @example intervalXorTime("09:00:00", "17:00:00", "09:00:00", "17:00:00") // []
 * @example intervalXorTime("invalid", "12:00:00", "13:00:00", "17:00:00") // []
 */
export function intervalXorTime(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): Array<{
  /**
   * The clock time the interval begins at, as an ISO 8601 time string with no date, offset or time
   * zone.
   */
  start: string;
  /**
   * The first clock time after the interval, in the same format as `start`. It is exclusive: the
   * interval holds everything from `start` up to but not including this value. It is always later
   * than `start`.
   */
  end: string;
}> {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return [];
  }

  const aS = plainTimeOf(aStart);

  const aE = plainTimeOf(aEnd);

  const bS = plainTimeOf(bStart);

  const bE = plainTimeOf(bEnd);

  if (aS === null || aE === null || bS === null || bE === null) {
    return [];
  }

  try {
    if (Temporal.PlainTime.compare(aS, aE) > 0) {
      return [];
    }

    if (Temporal.PlainTime.compare(bS, bE) > 0) {
      return [];
    }

    return halfOpenXor(
      [
        { start: aS, end: aE },
        { start: bS, end: bE },
      ],
      Temporal.PlainTime.compare,
    ).map(({ start, end }) => ({
      start: start.toString(),
      end: end.toString(),
    }));
  } catch {
    return [];
  }
}
