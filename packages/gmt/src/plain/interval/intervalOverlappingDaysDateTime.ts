import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";

/**
 * Return how many distinct calendar dates two datetime intervals share.
 *
 * - Counts the number of local dates touched by the closed intersection
 *   `[max(aStart, bStart), min(aEnd, bEnd)]` — inclusive of both endpoints.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one date and count as `1`.
 * - Returns `0` when the intervals do not overlap at all (a well-defined answer, not
 *   invalid input).
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 * - Diverges from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed
 *   24-hour periods instead of counting calendar dates (its own doc example — Jan 10-20 vs
 *   Jan 17-21 — returns 3 there, 4 here). To reproduce date-fns's number, compose
 *   `intervalIntersectionDateTime` with `intervalCountDateTime`:
 *   `const span = intervalIntersectionDateTime(aStart, aEnd, bStart, bEnd); span ? intervalCountDateTime(span.start, span.end, "day") : 0;`
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns number of shared calendar dates, `0` when disjoint, or null on invalid input
 *
 * @example intervalOverlappingDaysDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "2024-01-01T23:59:00", "2024-01-02T00:01:00") // 2
 * @example intervalOverlappingDaysDateTime("2024-01-01T00:00:00", "2024-01-02T00:00:00", "2024-01-02T00:00:00", "2024-01-03T00:00:00") // 1 (adjacent)
 * @example intervalOverlappingDaysDateTime("2024-01-01T00:00:00", "2024-01-02T00:00:00", "2024-01-02T00:00:00.001", "2024-01-03T00:00:00") // 0 (disjoint)
 * @example intervalOverlappingDaysDateTime("invalid", "2024-06-30T23:59:59", "2024-04-01T00:00:00", "2024-12-31T23:59:59") // null
 */
export function intervalOverlappingDaysDateTime(
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
    !plainDateTime.test(aStart) ||
    !plainDateTime.test(aEnd) ||
    !plainDateTime.test(bStart) ||
    !plainDateTime.test(bEnd)
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

    if (
      Temporal.PlainDateTime.compare(aE, bS) < 0 ||
      Temporal.PlainDateTime.compare(bE, aS) < 0
    ) {
      return 0;
    }

    const start = Temporal.PlainDateTime.compare(aS, bS) >= 0 ? aS : bS;
    const end = Temporal.PlainDateTime.compare(aE, bE) <= 0 ? aE : bE;
    const startDate = start.toPlainDate();
    const endDate = end.toPlainDate();

    return startDate.until(endDate, { largestUnit: "day" }).days + 1;
  } catch {
    return null;
  }
}
