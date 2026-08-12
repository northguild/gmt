import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../../regex";

/**
 * Return true if `start` and `end` form a valid datetime interval — both parseable as
 * ISO PlainDateTime strings and `start <= end`.
 *
 * - Both inputs must be ISO 8601 datetime strings (e.g. `"2024-01-01T10:00:00"`).
 * - Equal `start === end` is valid.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 *
 * @param start ISO 8601 datetime string (interval start)
 * @param end ISO 8601 datetime string (interval end)
 * @returns true if start and end form a valid datetime interval, or false on invalid input
 *
 * @example isValidDateTimeInterval("2024-01-01T10:00:00", "2024-12-31T23:59:59") // true
 * @example isValidDateTimeInterval("2024-01-01T10:00:00", "2024-01-01T10:00:00") // true
 * @example isValidDateTimeInterval("2024-12-31T23:59:59", "2024-01-01T10:00:00") // false
 * @example isValidDateTimeInterval("invalid", "2024-12-31T23:59:59") // false
 */
export function isValidDateTimeInterval(start: string, end: string): boolean {
  if (typeof start !== "string" || typeof end !== "string") {
    return false;
  }

  if (!plainDateTime.test(start) || !plainDateTime.test(end)) {
    return false;
  }

  try {
    return (
      Temporal.PlainDateTime.compare(
        Temporal.PlainDateTime.from(start),
        Temporal.PlainDateTime.from(end),
      ) <= 0
    );
  } catch {
    return false;
  }
}
