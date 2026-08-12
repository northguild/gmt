import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";

/**
 * Return the overlapping span of two datetime intervals, or null when they do not overlap.
 *
 * - Uses `Temporal.PlainDateTime.compare` for comparison.
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and DO overlap.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings).
 *
 * @param aStart ISO 8601 datetime string for the first interval start
 * @param aEnd ISO 8601 datetime string for the first interval end
 * @param bStart ISO 8601 datetime string for the second interval start
 * @param bEnd ISO 8601 datetime string for the second interval end
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap
 *
 * @example intervalIntersectionDateTime("2024-01-01T10:00:00", "2024-06-30T23:59:59", "2024-04-01T00:00:00", "2024-12-31T23:59:59") // { start: "2024-04-01T00:00:00", end: "2024-06-30T23:59:59" }
 * @example intervalIntersectionDateTime("2024-01-01T10:00:00", "2024-06-30T23:59:59", "2024-07-01T00:00:00", "2024-12-31T23:59:59") // null
 * @example intervalIntersectionDateTime("2024-01-01T10:00:00", "2024-06-30T23:59:59", "2024-07-02T00:00:00", "2024-12-31T23:59:59") // null
 * @example intervalIntersectionDateTime("invalid", "2024-06-30T23:59:59", "2024-04-01T00:00:00", "2024-12-31T23:59:59") // null
 */
export function intervalIntersectionDateTime(
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
      return null;
    }

    const start = Temporal.PlainDateTime.compare(aS, bS) >= 0 ? aS : bS;
    const end = Temporal.PlainDateTime.compare(aE, bE) <= 0 ? aE : bE;

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
