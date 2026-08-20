import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return how many distinct UTC calendar dates two UTC intervals share.
 *
 * - Counts the number of UTC dates touched by the closed intersection
 *   `[max(aStart, bStart), min(aEnd, bEnd)]` — inclusive of both endpoints.
 * - Boundaries are UTC boundaries — no DST is involved.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one date and count as `1`.
 * - Returns `0` when the intervals do not overlap at all (a well-defined answer, not
 *   invalid input).
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings, leap seconds).
 * - Diverges from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed
 *   24-hour periods instead of counting calendar dates (its own doc example — Jan 10-20 vs
 *   Jan 17-21 — returns 3 there, 4 here). To reproduce date-fns's number, compose
 *   `intervalIntersectionUtc` with `intervalCountUtc`:
 *   `const span = intervalIntersectionUtc(aStart, aEnd, bStart, bEnd); span ? intervalCountUtc(span.start, span.end, "day") : 0;`
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end
 * @returns number of shared calendar dates, `0` when disjoint, or null on invalid input
 *
 * @example intervalOverlappingDaysUtc("2024-01-01T23:59:00Z", "2024-01-02T00:01:00Z", "2024-01-01T23:59:00Z", "2024-01-02T00:01:00Z") // 2
 * @example intervalOverlappingDaysUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-03T00:00:00Z") // 1 (adjacent)
 * @example intervalOverlappingDaysUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-03T00:00:00Z", "2024-01-04T00:00:00Z") // 0 (disjoint)
 * @example intervalOverlappingDaysUtc("invalid", "2024-06-30T23:59:59Z", "2024-04-01T00:00:00Z", "2024-12-31T23:59:59Z") // null
 */
export function intervalOverlappingDaysUtc(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number | null {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return null;
  }

  if (
    !utcDateTime.test(aStart) ||
    !utcDateTime.test(aEnd) ||
    !utcDateTime.test(bStart) ||
    !utcDateTime.test(bEnd)
  ) {
    return null;
  }

  if (
    isLeapSecond(aStart) ||
    isLeapSecond(aEnd) ||
    isLeapSecond(bStart) ||
    isLeapSecond(bEnd)
  ) {
    return null;
  }

  try {
    const aS = Temporal.Instant.from(aStart);
    const aE = Temporal.Instant.from(aEnd);
    const bS = Temporal.Instant.from(bStart);
    const bE = Temporal.Instant.from(bEnd);

    if (Temporal.Instant.compare(aS, aE) > 0) {
      return null;
    }

    if (Temporal.Instant.compare(bS, bE) > 0) {
      return null;
    }

    if (
      Temporal.Instant.compare(aE, bS) < 0 ||
      Temporal.Instant.compare(bE, aS) < 0
    ) {
      return 0;
    }

    const start = Temporal.Instant.compare(aS, bS) >= 0 ? aS : bS;
    const end = Temporal.Instant.compare(aE, bE) <= 0 ? aE : bE;
    const startDate = start.toZonedDateTimeISO("UTC").toPlainDate();
    const endDate = end.toZonedDateTimeISO("UTC").toPlainDate();

    return startDate.until(endDate, { largestUnit: "day" }).days + 1;
  } catch {
    return null;
  }
}
