import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";

/**
 * Return how many distinct calendar dates two date intervals share.
 *
 * - Counts the number of dates touched by the closed intersection
 *   `[max(aStart, bStart), min(aEnd, bEnd)]` — inclusive of both endpoints.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one date and count as `1`.
 * - Returns `0` when the intervals do not overlap at all (a well-defined answer, not
 *   invalid input).
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 * - Diverges from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed
 *   24-hour periods instead of counting calendar dates (its own doc example — Jan 10-20 vs
 *   Jan 17-21 — returns 3 there, 4 here). To reproduce date-fns's number, compose
 *   `intervalIntersectionDate` with `intervalCountDate`:
 *   `const span = intervalIntersectionDate(aStart, aEnd, bStart, bEnd); span ? intervalCountDate(span.start, span.end, "day") : 0;`
 *
 * @param aStart ISO 8601 date string for the first interval start
 * @param aEnd ISO 8601 date string for the first interval end
 * @param bStart ISO 8601 date string for the second interval start
 * @param bEnd ISO 8601 date string for the second interval end
 * @returns number of shared calendar dates, `0` when disjoint, or null on invalid input
 *
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // 91
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-12-31", "2024-02-01", "2024-02-29") // 29
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31") // 1 (adjacent)
 * @example intervalOverlappingDaysDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // 0 (disjoint)
 * @example intervalOverlappingDaysDate("invalid", "2024-06-30", "2024-04-01", "2024-12-31") // null
 */
export function intervalOverlappingDaysDate(
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
    !plainDate.test(aStart) ||
    !plainDate.test(aEnd) ||
    !plainDate.test(bStart) ||
    !plainDate.test(bEnd)
  ) {
    return null;
  }

  try {
    const aS = Temporal.PlainDate.from(aStart);
    const aE = Temporal.PlainDate.from(aEnd);
    const bS = Temporal.PlainDate.from(bStart);
    const bE = Temporal.PlainDate.from(bEnd);

    if (Temporal.PlainDate.compare(aS, aE) > 0) {
      return null;
    }

    if (Temporal.PlainDate.compare(bS, bE) > 0) {
      return null;
    }

    if (
      Temporal.PlainDate.compare(aE, bS) < 0 ||
      Temporal.PlainDate.compare(bE, aS) < 0
    ) {
      return 0;
    }

    const start = Temporal.PlainDate.compare(aS, bS) >= 0 ? aS : bS;
    const end = Temporal.PlainDate.compare(aE, bE) <= 0 ? aE : bE;

    return start.until(end, { largestUnit: "day" }).days + 1;
  } catch {
    return null;
  }
}
