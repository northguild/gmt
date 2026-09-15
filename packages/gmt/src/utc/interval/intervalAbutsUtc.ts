import { Temporal } from "@js-temporal/polyfill";
import { closedIntervalsAbut } from "../../internal";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return true when two UTC intervals are exactly adjacent — one's end is one nanosecond
 * before the other's start, so they share no instant and leave no gap.
 *
 * - Uses `Temporal.Instant.compare` for comparison.
 * - Returns `true` when `bStart - 1 nanosecond === aEnd` (with `aEnd < bStart`) or
 *   `aStart - 1 nanosecond === bEnd` (with `bEnd < aStart`). The step is taken down from the later
 *   start, so an interval ending at the last representable instant still abuts.
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
 * @example intervalAbutsUtc("2024-06-30T12:00:00.000000001Z", "2024-12-31T17:00:00Z", "2024-01-01T09:00:00Z", "2024-06-30T12:00:00Z") // true
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

    return closedIntervalsAbut(
      aS,
      aE,
      bS,
      bE,
      Temporal.Instant.compare,
      (value) => value.subtract({ nanoseconds: 1 }),
    );
  } catch {
    return false;
  }
}
