import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return true when interval B is fully contained within interval A — every instant of B
 * falls within A.
 *
 * - Uses `Temporal.Instant.compare` for comparison.
 * - Equivalent to 4-argument `intervalContainsUtc(aStart, aEnd, bStart, bEnd)`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 UTC datetime string for the outer interval start
 * @param aEnd ISO 8601 UTC datetime string for the outer interval end
 * @param bStart ISO 8601 UTC datetime string for the inner interval start
 * @param bEnd ISO 8601 UTC datetime string for the inner interval end
 * @returns true if B is fully contained in A, or false on invalid input
 *
 * @example intervalEngulfsUtc("2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z", "2024-06-01T12:00:00Z", "2024-07-01T13:00:00Z") // true
 * @example intervalEngulfsUtc("2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z", "2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z") // true (equal intervals)
 * @example intervalEngulfsUtc("2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z", "2024-01-01T09:00:00Z", "2024-06-30T12:00:00Z") // true
 * @example intervalEngulfsUtc("2024-06-01T12:00:00Z", "2024-07-01T13:00:00Z", "2024-01-01T09:00:00Z", "2024-12-31T17:00:00Z") // false
 * @example intervalEngulfsUtc("invalid", "2024-12-31T17:00:00Z", "2024-06-01T12:00:00Z", "2024-07-01T13:00:00Z") // false
 */
export function intervalEngulfsUtc(
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

    return (
      Temporal.Instant.compare(aS, bS) <= 0 &&
      Temporal.Instant.compare(bE, aE) <= 0
    );
  } catch {
    return false;
  }
}
