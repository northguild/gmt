import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return true when two UTC intervals are exactly adjacent — one's end equals the other's
 * start with zero gap and zero overlap.
 *
 * - Uses `Temporal.Instant.compare` for comparison.
 * - Returns `true` when `aEnd + 1 nanosecond === bStart` or `bEnd + 1 nanosecond === aStart`.
 * - Returns `false` when intervals overlap, are disjoint with a gap, or are invalid.
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the first interval start
 * @param aEnd ISO 8601 UTC datetime string for the first interval end
 * @param bStart ISO 8601 UTC datetime string for the second interval start
 * @param bEnd ISO 8601 UTC datetime string for the second interval end
 * @returns true if intervals are exactly adjacent, or false on invalid input
 *
 * @example intervalAbutsUtc("2024-01-01T09:00:00Z", "2024-06-30T12:00:00Z", "2024-06-30T12:00:00.000000001Z", "2024-12-31T17:00:00Z") // true
 * @example intervalAbutsUtc("2024-06-30T12:00:00Z", "2024-12-31T17:00:00Z", "2024-01-01T09:00:00Z", "2024-06-30T12:00:00.000000001Z") // true
 * @example intervalAbutsUtc("2024-01-01T09:00:00Z", "2024-06-30T12:00:00Z", "2024-06-30T12:00:01Z", "2024-12-31T17:00:00Z") // false (gap)
 * @example intervalAbutsUtc("2024-01-01T09:00:00Z", "2024-06-30T13:00:00Z", "2024-06-30T12:00:00Z", "2024-12-31T17:00:00Z") // false (overlap)
 * @example intervalAbutsUtc("invalid", "2024-06-30T12:00:00Z", "2024-06-30T12:00:00Z", "2024-12-31T17:00:00Z") // false
 */
export function intervalAbutsUtc(
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
    const aS = Temporal.Instant.from(aStart);
    const aE = Temporal.Instant.from(aEnd);
    const bS = Temporal.Instant.from(bStart);
    const bE = Temporal.Instant.from(bEnd);

    if (Temporal.Instant.compare(aS, aE) > 0) {
      return false;
    }

    if (Temporal.Instant.compare(bS, bE) > 0) {
      return false;
    }

    // aEnd + 1 nanosecond === bStart
    const aEndPlusOne = aE.add({ nanoseconds: 1 });
    if (Temporal.Instant.compare(aEndPlusOne, bS) === 0) {
      return true;
    }

    // bEnd + 1 nanosecond === aStart
    const bEndPlusOne = bE.add({ nanoseconds: 1 });
    if (Temporal.Instant.compare(bEndPlusOne, aS) === 0) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
