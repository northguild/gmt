import { Temporal } from "@js-temporal/polyfill";
import { zonedDateTimeFrom } from "../../../internal";
import { isValidZonedDateTime } from "../../validate/isValidZonedDateTime";

/**
 * Return true if `start` and `end` form a valid zoned interval — both valid ISO ZonedDateTime
 * strings (`isValidZonedDateTime`) and the instant at `start` is <= the instant at `end`.
 *
 * - Both inputs must be valid ISO 8601 zoned datetime strings.
 * - Equal `start === end` is valid.
 * - Comparison is done by instant, so intervals spanning DST transitions are compared
 *   by absolute time.
 * - Reads RFC 9557 annotations as `isValidZonedDateTime` does: `[u-ca=iso8601]` and elective
 *   annotations (`[foo=bar]`) are accepted, an unknown critical annotation (`[!foo=bar]`) is
 *   rejected, and a non-ISO calendar is `isValidCalendarZonedInterval`'s input.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 *
 * @param start ISO ZonedDateTime string (interval start)
 * @param end ISO ZonedDateTime string (interval end)
 * @returns true if start and end form a valid zoned interval, or false on invalid input
 *
 * @example isValidZonedInterval("2024-01-01T10:00:00+00:00[UTC]", "2024-12-31T23:59:59+00:00[UTC]") // true
 * @example isValidZonedInterval("2024-06-15T12:00:00-04:00[America/New_York]", "2024-06-15T12:00:00-04:00[America/New_York]") // true
 * @example isValidZonedInterval("2024-12-31T23:59:59+00:00[UTC]", "2024-01-01T10:00:00+00:00[UTC]") // false
 * @example isValidZonedInterval("2024-01-01T10:00:00+00:00[UTC][u-ca=iso8601]", "2024-12-31T23:59:59+00:00[UTC][foo=bar]") // true (ISO calendar and elective annotations)
 * @example isValidZonedInterval("2024-01-01T10:00:00+00:00[UTC][u-ca=hebrew]", "2024-12-31T23:59:59+00:00[UTC]") // false (non-ISO calendar: use isValidCalendarZonedInterval)
 * @example isValidZonedInterval("invalid", "2024-12-31T23:59:59+00:00[UTC]") // false
 */
export function isValidZonedInterval(start: string, end: string): boolean {
  if (!isValidZonedDateTime(start) || !isValidZonedDateTime(end)) {
    return false;
  }

  try {
    const startInstant = zonedDateTimeFrom(start).toInstant();
    const endInstant = zonedDateTimeFrom(end).toInstant();

    return Temporal.Instant.compare(startInstant, endInstant) <= 0;
  } catch {
    return false;
  }
}
