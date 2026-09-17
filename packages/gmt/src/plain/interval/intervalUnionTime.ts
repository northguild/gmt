// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenUnion } from "../../internal";
import { isValidTime } from "../validate";

/**
 * Return the combined span of two time intervals, or null when they are disjoint.
 *
 * - Uses `Temporal.PlainTime.compare` for comparison.
 * - Half-open: an interval holds every `t` with `start <= t < end`. The union is returned only
 *   when it is one non-empty interval — the single run CORE-6's `mergeIntervals` would give.
 * - Overlapping intervals, and touching intervals (`aEnd === bStart`), return their combined span.
 * - Intervals with any gap between them return `null`, even a one-unit gap.
 * - An empty interval (`start === end`) is the empty set: it adds nothing, so the union is the
 *   other interval. Two empty intervals have no non-empty union and return `null`.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 time string for the first interval start
 * @param aEnd ISO 8601 time string for the first interval end
 * @param bStart ISO 8601 time string for the second interval start
 * @param bEnd ISO 8601 time string for the second interval end
 * @returns `{ start, end }` with the merged span, or null on invalid input / disjoint intervals
 *
 * @example intervalUnionTime("09:00:00", "17:00:00", "12:00:00", "18:00:00") // { start: "09:00:00", end: "18:00:00" }
 * @example intervalUnionTime("09:00:00", "17:00:00", "17:00:00", "18:00:00") // { start: "09:00:00", end: "18:00:00" } (touching)
 * @example intervalUnionTime("09:00:00", "17:00:00", "18:00:00", "20:00:00") // null
 * @example intervalUnionTime("invalid", "17:00:00", "12:00:00", "18:00:00") // null
 */
export function intervalUnionTime(
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

    const union = halfOpenUnion(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainTime.compare,
    );

    if (union === null) {
      return null;
    }

    const { start, end } = union;

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
