// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenIntersection } from "../../internal";
import { isValidDateTime } from "../validate";

/**
 * Return the overlapping span of two datetime intervals, or null when they do not overlap.
 *
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Half-open: an interval holds every `t` with `start <= t < end`. The intersection is
 *   `[max(aStart, bStart), min(aEnd, bEnd))` when `aStart < bEnd && bStart < aEnd` (CORE-6's
 *   `intersectIntervals`), otherwise `null`.
 * - Touching intervals (`aEnd === bStart`) share no moment and return `null`.
 * - An empty interval (`start === end`) intersects only an interval it lies strictly inside, and
 *   then returns itself.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap
 *
 * @example intervalIntersectionDateTime("2024-01-01T09:00:00", "2024-01-01T13:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // { start: "2024-01-01T12:00:00", end: "2024-01-01T13:00:00" }
 * @example intervalIntersectionDateTime("2024-01-01T09:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // null (touching)
 * @example intervalIntersectionDateTime("2024-01-01T09:00:00", "2024-01-01T17:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00") // { start: "2024-01-01T12:00:00", end: "2024-01-01T12:00:00" } (empty interval strictly inside)
 * @example intervalIntersectionDateTime("invalid", "2024-06-30T23:59:59", "2024-04-01T00:00:00", "2024-12-31T23:59:59") // null
 */
export function intervalIntersectionDateTime(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): { start: string; end: string } | null {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return null;
  }

  if (
    !isValidDateTime(aStart) ||
    !isValidDateTime(aEnd) ||
    !isValidDateTime(bStart) ||
    !isValidDateTime(bEnd)
  ) {
    return null;
  }

  try {
    const aS = Temporal.PlainDateTime.from(aStart);
    const aE = Temporal.PlainDateTime.from(aEnd);
    const bS = Temporal.PlainDateTime.from(bStart);
    const bE = Temporal.PlainDateTime.from(bEnd);

    if (Temporal.PlainDateTime.compare(aS, aE) > 0) {
      return null;
    }

    if (Temporal.PlainDateTime.compare(bS, bE) > 0) {
      return null;
    }

    const shared = halfOpenIntersection(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainDateTime.compare,
    );

    if (shared === null) {
      return null;
    }

    const { start, end } = shared;

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
