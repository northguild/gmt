// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { canonicalInstantIntervals } from "../../internal";
import { intersectIntervals } from "../../interval/calculate";
import { isValidUtc } from "../validate";

/**
 * Return the overlapping span of two UTC intervals, or null when they do not overlap.
 *
 * - Half-open: an interval holds every `t` with `start <= t < end`. The intersection is
 *   `[max(aStart, bStart), min(aEnd, bEnd))` when `aStart < bEnd && bStart < aEnd` (CORE-6's
 *   `intersectIntervals`), otherwise `null`.
 * - Touching intervals (`aEnd === bStart`) share no instant and return `null`.
 * - An empty interval (`start === end`) intersects only an interval it lies strictly inside, and
 *   then returns itself.
 * - Delegates to CORE-6's `intersectIntervals` once the arguments pass the UTC-string gate, and
 *   re-serialises the result, so it always equals that function's answer in canonical `Z` form.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, non-`Z` strings, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap
 *
 * @example intervalIntersectionUtc("2024-01-01T09:00:00Z", "2024-01-01T13:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // { start: "2024-01-01T12:00:00Z", end: "2024-01-01T13:00:00Z" }
 * @example intervalIntersectionUtc("2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z") // null (touching)
 * @example intervalIntersectionUtc("2024-01-01T09:00:00.000Z", "2024-01-01T13:00:00Z", "2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z") // { start: "2024-01-01T09:00:00Z", end: "2024-01-01T13:00:00Z" } (re-serialised)
 * @example intervalIntersectionUtc("invalid", "2024-06-30T23:59:59Z", "2024-04-01T00:00:00Z", "2024-12-31T23:59:59Z") // null
 */
export function intervalIntersectionUtc(
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

  const shared = intersectIntervals(
    { start: aStart, end: aEnd },
    { start: bStart, end: bEnd },
  );

  return shared === null
    ? null
    : (canonicalInstantIntervals([shared])?.[0] ?? null);
}
