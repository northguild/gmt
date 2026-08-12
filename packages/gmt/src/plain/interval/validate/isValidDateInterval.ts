import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../../regex";

/**
 * Return true if `start` and `end` form a valid date interval — both parseable as
 * ISO PlainDate strings and `start <= end`.
 *
 * - Both inputs must be ISO 8601 date strings (e.g. `"2024-01-01"`).
 * - Equal `start === end` is valid.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 *
 * @param start ISO 8601 date string (interval start)
 * @param end ISO 8601 date string (interval end)
 * @returns true if start and end form a valid date interval, or false on invalid input
 *
 * @example isValidDateInterval("2024-01-01", "2024-12-31") // true
 * @example isValidDateInterval("2024-01-01", "2024-01-01") // true
 * @example isValidDateInterval("2024-12-31", "2024-01-01") // false
 * @example isValidDateInterval("invalid", "2024-12-31") // false
 */
export function isValidDateInterval(start: string, end: string): boolean {
  if (typeof start !== "string" || typeof end !== "string") {
    return false;
  }

  if (!plainDate.test(start) || !plainDate.test(end)) {
    return false;
  }

  try {
    return (
      Temporal.PlainDate.compare(
        Temporal.PlainDate.from(start),
        Temporal.PlainDate.from(end),
      ) <= 0
    );
  } catch {
    return false;
  }
}
