import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return the overlapping span of two UTC intervals, or null when they do not overlap.
 *
 * - Uses `Temporal.Instant.compare` for comparison (same instant semantics).
 * - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and DO overlap.
 * - Returns `null` if either interval is invalid (`start > end`).
 * - Returns `null` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end
 * @returns `{ start, end }` with the overlapping span, or null on invalid input / no overlap
 *
 * @example intervalIntersectionUtc("2024-01-01T00:00:00Z", "2024-06-30T23:59:59Z", "2024-04-01T00:00:00Z", "2024-12-31T23:59:59Z") // { start: "2024-04-01T00:00:00Z", end: "2024-06-30T23:59:59Z" }
 * @example intervalIntersectionUtc("2024-01-01T00:00:00Z", "2024-06-30T23:59:59Z", "2024-07-01T00:00:00Z", "2024-12-31T23:59:59Z") // null
 * @example intervalIntersectionUtc("2024-01-01T00:00:00Z", "2024-06-30T23:59:59Z", "2024-07-02T00:00:00Z", "2024-12-31T23:59:59Z") // null
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
    const aSI = Temporal.Instant.from(aStart);
    const aEI = Temporal.Instant.from(aEnd);
    const bSI = Temporal.Instant.from(bStart);
    const bEI = Temporal.Instant.from(bEnd);

    if (Temporal.Instant.compare(aSI, aEI) > 0) {
      return null;
    }

    if (Temporal.Instant.compare(bSI, bEI) > 0) {
      return null;
    }

    if (
      Temporal.Instant.compare(aEI, bSI) < 0 ||
      Temporal.Instant.compare(bEI, aSI) < 0
    ) {
      return null;
    }

    const start = Temporal.Instant.compare(aSI, bSI) >= 0 ? aSI : bSI;
    const end = Temporal.Instant.compare(aEI, bEI) <= 0 ? aEI : bEI;

    return { start: start.toString(), end: end.toString() };
  } catch {
    return null;
  }
}
