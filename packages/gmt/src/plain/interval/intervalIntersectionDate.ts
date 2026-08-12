import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";

/**
 * Return the overlapping span of two date intervals, or null when they do not overlap.
 *
 * - Uses `Temporal.PlainDate.compare` for comparison.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and DO overlap.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 date string for the first interval start
 * @param aEnd ISO 8601 date string for the first interval end
 * @param bStart ISO 8601 date string for the second interval start
 * @param bEnd ISO 8601 date string for the second interval end
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap
 *
 * @example intervalIntersectionDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31") // { start: "2024-04-01", end: "2024-06-30" }
 * @example intervalIntersectionDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31") // { start: "2024-06-30", end: "2024-06-30" }
 * @example intervalIntersectionDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31") // null
 * @example intervalIntersectionDate("2024-01-01", "2024-06-30", "2024-02-01", "2024-03-01") // { start: "2024-02-01", end: "2024-03-01" }
 * @example intervalIntersectionDate("invalid", "2024-06-30", "2024-04-01", "2024-12-31") // null
 */
export function intervalIntersectionDate(
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
      return null;
    }

    const start = Temporal.PlainDate.compare(aS, bS) >= 0 ? aS : bS;
    const end = Temporal.PlainDate.compare(aE, bE) <= 0 ? aE : bE;

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
