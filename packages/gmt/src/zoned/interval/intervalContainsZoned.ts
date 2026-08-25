import { Temporal } from "@js-temporal/polyfill";
import { hasCalendarAnnotation } from "../../internal";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Return true when `pointOrStart` falls within the interval `[intervalStart, intervalEnd]`
 * (3-arg), or when the inner interval `[innerStart, innerEnd]` is fully contained within
 * the outer interval `[intervalStart, intervalEnd]` (4-arg).
 *
 * - Uses `Temporal.Instant.compare` for comparison (same instant semantics).
 * - Always-inclusive boundaries: `start <= point <= end`.
 * - Returns `false` if `intervalStart > intervalEnd` (invalid outer interval).
 * - Returns `false` if `innerStart > innerEnd` in 4-arg mode (invalid inner interval).
 * - Returns `false` on invalid input (wrong type, malformed strings, leap seconds).
 * - Rejects any `[u-ca=...]` calendar annotation (E5 issue #78, decision of record D2) — see
 *   `isValidZonedDateTime`'s JSDoc for why.
 *
 * @param intervalStart ISO 8601 zoned datetime string for the outer interval start
 * @param intervalEnd ISO 8601 zoned datetime string for the outer interval end
 * @param pointOrStart ISO 8601 zoned datetime string for the point (3-arg) or inner start (4-arg)
 * @param pointEnd optional ISO 8601 zoned datetime string for the inner interval end (4-arg mode)
 * @returns true if the point or inner interval is contained, or false on invalid input
 *
 * @example intervalContainsZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]", "2024-06-15T12:00:00+00:00[UTC]") // true
 * @example intervalContainsZoned("2024-01-01T00:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]", "2024-06-15T12:00:00+00:00[UTC]", "2024-07-15T12:00:00+00:00[UTC]") // true
 * @example intervalContainsZoned("2024-12-31T23:59:59+00:00[UTC]", "2024-01-01T00:00:00+00:00[UTC]", "2024-06-15T12:00:00+00:00[UTC]") // false
 * @example intervalContainsZoned("invalid", "2024-12-31T23:59:59+00:00[UTC]", "2024-06-15T12:00:00+00:00[UTC]") // false
 */
export function intervalContainsZoned(
  intervalStart: string,
  intervalEnd: string,
  pointOrStart: string,
  pointEnd?: string,
): boolean {
  if (
    typeof intervalStart !== "string" ||
    typeof intervalEnd !== "string" ||
    typeof pointOrStart !== "string" ||
    (pointEnd !== undefined && typeof pointEnd !== "string")
  ) {
    return false;
  }

  if (
    isLeapSecond(intervalStart) ||
    isLeapSecond(intervalEnd) ||
    isLeapSecond(pointOrStart) ||
    (pointEnd !== undefined && isLeapSecond(pointEnd)) ||
    hasCalendarAnnotation(intervalStart) ||
    hasCalendarAnnotation(intervalEnd) ||
    hasCalendarAnnotation(pointOrStart) ||
    (pointEnd !== undefined && hasCalendarAnnotation(pointEnd))
  ) {
    return false;
  }

  try {
    const startZdt = Temporal.ZonedDateTime.from(intervalStart);
    const endZdt = Temporal.ZonedDateTime.from(intervalEnd);
    const pointZdt = Temporal.ZonedDateTime.from(pointOrStart);

    const startInstant = startZdt.toInstant();
    const endInstant = endZdt.toInstant();
    const pointInstant = pointZdt.toInstant();

    if (Temporal.Instant.compare(startInstant, endInstant) > 0) {
      return false;
    }

    if (pointEnd === undefined) {
      return (
        Temporal.Instant.compare(startInstant, pointInstant) <= 0 &&
        Temporal.Instant.compare(pointInstant, endInstant) <= 0
      );
    }

    const endPointZdt = Temporal.ZonedDateTime.from(pointEnd);
    const endPointInstant = endPointZdt.toInstant();

    if (Temporal.Instant.compare(pointInstant, endPointInstant) > 0) {
      return false;
    }

    return (
      Temporal.Instant.compare(startInstant, pointInstant) <= 0 &&
      Temporal.Instant.compare(endPointInstant, endInstant) <= 0
    );
  } catch {
    return false;
  }
}
