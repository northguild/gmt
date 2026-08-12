import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return true when intervals `[aStart, aEnd]` and `[bStart, bEnd]` share at least one instant.
 *
 * - Uses `Temporal.Instant.compare` for comparison (same instant semantics).
 * - Adjacent intervals (e.g. `aEnd === bStart`) do NOT overlap — returns `false`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end
 * @returns true if intervals overlap, or false on invalid input
 *
 * @example intervalsOverlapUtc("2024-01-01T00:00:00Z", "2024-06-30T23:59:59Z", "2024-04-01T00:00:00Z", "2024-12-31T23:59:59Z") // true
 * @example intervalsOverlapUtc("2024-01-01T00:00:00Z", "2024-06-30T23:59:59Z", "2024-07-01T00:00:00Z", "2024-12-31T23:59:59Z") // false (adjacent)
 * @example intervalsOverlapUtc("2024-01-01T00:00:00Z", "2024-06-30T23:59:59Z", "2024-07-02T00:00:00Z", "2024-12-31T23:59:59Z") // false (disjoint)
 * @example intervalsOverlapUtc("invalid", "2024-06-30T23:59:59Z", "2024-04-01T00:00:00Z", "2024-12-31T23:59:59Z") // false
 */
export function intervalsOverlapUtc(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  if (
    typeof aStart !== "string" ||
    typeof aEnd !== "string" ||
    typeof bStart !== "string" ||
    typeof bEnd !== "string"
  ) {
    return false;
  }

  if (
    !utcDateTime.test(aStart) ||
    !utcDateTime.test(aEnd) ||
    !utcDateTime.test(bStart) ||
    !utcDateTime.test(bEnd)
  ) {
    return false;
  }

  if (
    isLeapSecond(aStart) ||
    isLeapSecond(aEnd) ||
    isLeapSecond(bStart) ||
    isLeapSecond(bEnd)
  ) {
    return false;
  }

  try {
    const aSI = Temporal.Instant.from(aStart);
    const aEI = Temporal.Instant.from(aEnd);
    const bSI = Temporal.Instant.from(bStart);
    const bEI = Temporal.Instant.from(bEnd);

    if (Temporal.Instant.compare(aSI, aEI) > 0) {
      return false;
    }

    if (Temporal.Instant.compare(bSI, bEI) > 0) {
      return false;
    }

    return (
      Temporal.Instant.compare(aEI, bSI) >= 0 &&
      Temporal.Instant.compare(bEI, aSI) >= 0
    );
  } catch {
    return false;
  }
}
