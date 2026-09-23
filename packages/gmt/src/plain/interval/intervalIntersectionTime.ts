// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenIntersection } from "../../internal";
import { isValidTime } from "../validate";

/**
 * Return the overlapping span of two time intervals, or null when they do not overlap.
 *
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Half-open: an interval holds every `t` with `start <= t < end`. The intersection is
 *   `[max(aStart, bStart), min(aEnd, bEnd))` when `aStart < bEnd && bStart < aEnd` (CORE-6's
 *   `intersectIntervals`), otherwise `null`.
 * - Touching intervals (`aEnd === bStart`) share no clock time and return `null`.
 * - An empty interval (`start === end`) intersects only an interval it lies strictly inside, and
 *   then returns itself.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the first interval start
 * @param aEnd ISO 8601 time string for the first interval end
 * @param bStart ISO 8601 time string for the second interval start
 * @param bEnd ISO 8601 time string for the second interval end
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap
 *
 * @example intervalIntersectionTime("09:00:00", "17:00:00", "12:00:00", "18:00:00") // { start: "12:00:00", end: "17:00:00" }
 * @example intervalIntersectionTime("09:00:00", "17:00:00", "17:00:00", "18:00:00") // null (touching)
 * @example intervalIntersectionTime("09:00:00", "17:00:00", "10:00:00", "11:00:00") // { start: "10:00:00", end: "11:00:00" }
 * @example intervalIntersectionTime("invalid", "17:00:00", "12:00:00", "18:00:00") // null
 */
export function intervalIntersectionTime(
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
    !isValidTime(aStart) ||
    !isValidTime(aEnd) ||
    !isValidTime(bStart) ||
    !isValidTime(bEnd)
  ) {
    return null;
  }

  try {
    const aS = Temporal.PlainTime.from(aStart);
    const aE = Temporal.PlainTime.from(aEnd);
    const bS = Temporal.PlainTime.from(bStart);
    const bE = Temporal.PlainTime.from(bEnd);

    if (Temporal.PlainTime.compare(aS, aE) > 0) {
      return null;
    }

    if (Temporal.PlainTime.compare(bS, bE) > 0) {
      return null;
    }

    const shared = halfOpenIntersection(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainTime.compare,
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
