// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { canonicalInstantIntervals } from "../../internal";
import { mergeIntervals } from "../../interval/calculate";
import { isValidUtc } from "../validate";

/**
 * Return the combined span of two UTC intervals, or null when they are disjoint.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`. The union is returned only
 *   when it is one non-empty interval — the single run CORE-6's `mergeIntervals` would give.
 * - Overlapping intervals, and touching intervals (`aEnd === bStart`), return their combined span.
 * - Intervals with any gap between them return `null`, even a one-unit gap.
 * - An empty interval (`start === end`) is the empty set: it adds nothing, so the union is the
 *   other interval. Two empty intervals have no non-empty union and return `null`.
 * - Delegates to CORE-6's `mergeIntervals` once the arguments pass the UTC-string gate, and
 *   re-serialises the run to canonical `Z` strings.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, non-`Z` strings, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end
 * @returns `{ start, end }` with the merged span, or null on invalid input / disjoint intervals
 *
 * @example intervalUnionUtc("2024-01-01T09:00:00Z", "2024-01-01T13:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }
 * @example intervalUnionUtc("2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" } (touching)
 * @example intervalUnionUtc("2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00.000000001Z", "2024-01-01T17:00:00Z") // null (1 ns gap)
 * @example intervalUnionUtc("invalid", "2024-06-30T23:59:59Z", "2024-04-01T00:00:00Z", "2024-12-31T23:59:59Z") // null
 */
export function intervalUnionUtc(
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
    !isValidUtc(aStart) ||
    !isValidUtc(aEnd) ||
    !isValidUtc(bStart) ||
    !isValidUtc(bEnd)
  ) {
    return null;
  }

  const runs = mergeIntervals([
    { start: aStart, end: aEnd },
    { start: bStart, end: bEnd },
  ]);

  // mergeIntervals returns [] for an invalid (reversed) interval, so that also gives null.
  return runs.length === 1
    ? (canonicalInstantIntervals(runs)?.[0] ?? null)
    : null;
}
