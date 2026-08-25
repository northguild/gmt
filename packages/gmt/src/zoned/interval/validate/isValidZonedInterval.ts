import { Temporal } from "@js-temporal/polyfill";
import { hasCalendarAnnotation } from "../../../internal";
import { isLeapSecond } from "../../../plain/validate/isLeapSecond";

/**
 * Return true if `start` and `end` form a valid zoned interval — both parseable as
 * ISO ZonedDateTime strings and the instant at `start` is <= the instant at `end`.
 *
 * - Both inputs must be valid ISO 8601 zoned datetime strings.
 * - Equal `start === end` is valid.
 * - Comparison is done by instant, so intervals spanning DST transitions are compared
 *   by absolute time.
 * - Rejects any `[u-ca=...]` calendar annotation (E5 issue #78, decision of record D2) — see
 *   `isValidZonedDateTime`'s JSDoc for why.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 *
 * @param start ISO ZonedDateTime string (interval start)
 * @param end ISO ZonedDateTime string (interval end)
 * @returns true if start and end form a valid zoned interval, or false on invalid input
 *
 * @example isValidZonedInterval("2024-01-01T10:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // true
 * @example isValidZonedInterval("2024-06-15T12:00:00-04:00[America/New_York]", "2024-06-15T12:00:00-04:00[America/New_York]") // true
 * @example isValidZonedInterval("2024-12-31T23:59:59+00:00[UTC]", "2024-01-01T10:00:00+00:00[UTC]") // false
 * @example isValidZonedInterval("2024-01-01T10:00:00+00:00[UTC][u-ca=hebrew]", "2024-12-31T23:59:59+00:00[UTC]") // false (calendar annotation rejected)
 * @example isValidZonedInterval("invalid", "2024-12-31T23:59:59+00:00[UTC]") // false
 */
export function isValidZonedInterval(start: string, end: string): boolean {
  if (typeof start !== "string" || typeof end !== "string") {
    return false;
  }

  if (
    isLeapSecond(start) ||
    isLeapSecond(end) ||
    hasCalendarAnnotation(start) ||
    hasCalendarAnnotation(end)
  ) {
    return false;
  }

  try {
    const startInstant = Temporal.ZonedDateTime.from(start).toInstant();
    const endInstant = Temporal.ZonedDateTime.from(end).toInstant();

    return Temporal.Instant.compare(startInstant, endInstant) <= 0;
  } catch {
    return false;
  }
}
