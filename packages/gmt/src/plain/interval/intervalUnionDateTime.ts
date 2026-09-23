// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "@js-temporal/polyfill";
import { halfOpenUnion } from "../../internal";
import { isValidDateTime } from "../validate";

/**
 * Return the combined span of two datetime intervals, or null when they are disjoint.
 *
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Half-open: an interval holds every `t` with `start <= t < end`. The union is returned only
 *   when it is one non-empty interval — the single run CORE-6's `mergeIntervals` would give.
 * - Overlapping intervals, and touching intervals (`aEnd === bStart`), return their combined span.
 * - Two **non-empty** intervals with any gap between them return `null`, even a one-unit gap.
 *   The caveat matters: an empty interval is the empty set, so it is never “separated” from
 *   anything. A non-empty interval unioned with an empty one far away is still that non-empty
 *   interval — see the next bullet — not `null`.
 * - An empty interval (`start === end`) is the empty set: it adds nothing, so the union is the
 *   other interval. Two empty intervals have no non-empty union and return `null`.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns `{ start, end }` with the merged span, or null on invalid input / disjoint intervals
 *
 * @example intervalUnionDateTime("2024-01-01T09:00:00", "2024-01-01T13:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // { start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00" }
 * @example intervalUnionDateTime("2024-01-01T09:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00", "2024-01-01T17:00:00") // { start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00" } (touching)
 * @example intervalUnionDateTime("2024-01-01T09:00:00", "2024-01-01T12:00:00", "2024-01-01T12:00:00.000000001", "2024-01-01T17:00:00") // null (1 ns gap)
 * @example intervalUnionDateTime("invalid", "2024-06-30T23:59:59", "2024-04-01T00:00:00", "2024-12-31T23:59:59") // null
 */
export function intervalUnionDateTime(
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

    const union = halfOpenUnion(
      { start: aS, end: aE },
      { start: bS, end: bE },
      Temporal.PlainDateTime.compare,
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
