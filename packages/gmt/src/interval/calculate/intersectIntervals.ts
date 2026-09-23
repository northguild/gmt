import { parseIntervalNanoseconds } from "../../internal";
import type { Interval } from "../../types";

/**
 * Return the half-open interval two intervals share, or null when they share no instant.
 *
 * - Non-null exactly when `intervalsOverlap(a, b)` is true: touching intervals return `null`.
 * - An empty interval strictly inside the other is returned as the intersection.
 * - Endpoints are the caller's own strings, never re-serialised. When `a` and `b` spell the same
 *   instant differently, `a`'s spelling is used (GMT rule: the first argument wins ties).
 * - The positional `intervalIntersectionUtc` (…) follow the same half-open rule and return
 *   re-serialised endpoints instead of echoing the caller's strings.
 * - Returns `null` on invalid input — either interval not an `Interval`, or inverted.
 *
 * @param a `{ start, end }` record of ISO 8601 instant strings; its strings win ties
 * @param b `{ start, end }` record of ISO 8601 instant strings
 * @returns `{ start, end }` of the shared span, or null when disjoint, touching, or on invalid input
 *
 * @example intersectIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }) // { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" }
 * @example intersectIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" }) // null — touching
 * @example intersectIntervals({ start: "2024-01-01T04:00:00-05:00", end: "2024-01-01T12:00:00-05:00" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // { start: "2024-01-01T04:00:00-05:00", end: "2024-01-01T12:00:00-05:00" } — same instants, first argument's spelling
 * @example intersectIntervals({ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }) // null — disjoint
 * @example intersectIntervals({ start: "invalid", end: "2024-01-01T17:00:00Z" }, { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }) // null
 */
export function intersectIntervals(a: Interval, b: Interval): Interval | null {
  try {
    const first = parseIntervalNanoseconds(a);
    const second = parseIntervalNanoseconds(b);

    if (first === null || second === null) {
      return null;
    }

    if (!(first.start < second.end && second.start < first.end)) {
      return null;
    }

    return {
      start: first.start >= second.start ? first.startText : second.startText,
      end: first.end <= second.end ? first.endText : second.endText,
    };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
