// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenXor } from "../../internal";
import { isValidDateTime } from "../validate";

/**
 * Return the symmetric difference of two datetime intervals — time covered by exactly one interval.
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
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns array of `{ start, end }` records representing the symmetric difference, or `[]` on invalid input
 *
 * @example intervalXorDateTime("2024-01-01T09:00:00", "2024-01-01T13:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // [{ start: "2024-01-01T09:00:00", end: "2024-01-01T12:00:00" }, { start: "2024-01-01T13:00:00", end: "2024-01-01T17:00:00" }]
 * @example intervalXorDateTime("2024-01-01T09:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // [{ start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00" }] (touching)
 * @example intervalXorDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T09:00:00", "2024-01-01T17:00:00") // []
 * @example intervalXorDateTime("invalid", "2024-06-30T12:00:00", "2024-07-01T13:00:00", "2024-12-31T17:00:00") // []
 */
export function intervalXorDateTime(
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

    return halfOpenXor(
      [
        { start: aS, end: aE },
        { start: bS, end: bE },
      ],
      Temporal.PlainDateTime.compare,
    ).map(({ start, end }) => ({
      start: start.toString(),
      end: end.toString(),
    }));
  } catch {
    return [];
  }
}
