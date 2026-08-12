import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../../plain/validate/isLeapSecond";
import { utcDateTime } from "../../../regex/utc-date-time";

/**
 * Return true if `start` and `end` form a valid UTC interval — both parseable as
 * ISO UTC datetime strings and the instant at `start` is <= the instant at `end`.
 *
 * - Both inputs must be ISO 8601 UTC datetime strings (e.g. `"2024-01-01T10:00:00Z"`).
 * - Equal `start === end` is valid.
 * - Leap-second strings return `false`.
 * - Invalid input or malformed strings return `false`.
 *
 * @param start ISO 8601 UTC datetime string (interval start)
 * @param end ISO 8601 UTC datetime string (interval end)
 * @returns true if start and end form a valid UTC interval, or false on invalid input
 *
 * @example isValidUtcInterval("2024-01-01T10:00:00Z", "2024-12-31T23:59:59Z") // true
 * @example isValidUtcInterval("2024-01-01T10:00:00Z", "2024-01-01T10:00:00Z") // true
 * @example isValidUtcInterval("2024-12-31T23:59:59Z", "2024-01-01T10:00:00Z") // false
 * @example isValidUtcInterval("invalid", "2024-12-31T23:59:59Z") // false
 */
export function isValidUtcInterval(start: string, end: string): boolean {
  if (typeof start !== "string" || typeof end !== "string") {
    return false;
  }

  if (!utcDateTime.test(start) || !utcDateTime.test(end)) {
    return false;
  }

  if (isLeapSecond(start) || isLeapSecond(end)) {
    return false;
  }

  try {
    const startInstant = Temporal.Instant.from(start);
    const endInstant = Temporal.Instant.from(end);

    return Temporal.Instant.compare(startInstant, endInstant) <= 0;
  } catch {
    return false;
  }
}
