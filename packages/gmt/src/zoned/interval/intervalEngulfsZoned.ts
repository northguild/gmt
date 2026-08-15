import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Return true when interval B is fully contained within interval A — every instant of B
 * falls within A.
 *
 * - Uses `Temporal.Instant.compare` for comparison (via `.toInstant()`).
 * - Equivalent to 4-argument `intervalContainsZoned(aStart, aEnd, bStart, bEnd)`.
 * - Returns `false` if either interval is invalid (`start > end`).
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 *
 * @param aStart ISO 8601 zoned datetime string for the outer interval start
 * @param aEnd ISO 8601 zoned datetime string for the outer interval end
 * @param bStart ISO 8601 zoned datetime string for the inner interval start
 * @param bEnd ISO 8601 zoned datetime string for the inner interval end
 * @returns true if B is fully contained in A, or false on invalid input
 *
 * @example intervalEngulfsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-06-01T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]") // true
 * @example intervalEngulfsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // true (equal intervals)
 * @example intervalEngulfsZoned("2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-06-30T12:00:00+00:00[UTC]") // true
 * @example intervalEngulfsZoned("2024-06-01T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]", "2024-01-01T09:00:00+00:00[UTC]", "2024-12-31T17:00:00+00:00[UTC]") // false
 * @example intervalEngulfsZoned("invalid", "2024-12-31T17:00:00+00:00[UTC]", "2024-06-01T12:00:00+00:00[UTC]", "2024-07-01T13:00:00+00:00[UTC]") // false
 */
export function intervalEngulfsZoned(
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
    isLeapSecond(aStart) ||
    isLeapSecond(aEnd) ||
    isLeapSecond(bStart) ||
    isLeapSecond(bEnd)
  ) {
    return false;
  }

  try {
    const aSZdt = Temporal.ZonedDateTime.from(aStart);
    const aEZdt = Temporal.ZonedDateTime.from(aEnd);
    const bSZdt = Temporal.ZonedDateTime.from(bStart);
    const bEZdt = Temporal.ZonedDateTime.from(bEnd);

    const aS = aSZdt.toInstant();
    const aE = aEZdt.toInstant();
    const bS = bSZdt.toInstant();
    const bE = bEZdt.toInstant();

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
