import { Temporal } from "@js-temporal/polyfill";
import { parseCalendarDateValue } from "../../../internal";
import { isValidCalendarDate } from "../../validate";

/**
 * Return true if `start` and `end` form a valid date interval — both parseable as
 * ISO PlainDate strings and `start <= end`.
 *
 * - Both inputs must be ISO 8601 date strings (e.g. `"2024-01-01"`).
 * - Equal `start === end` is valid.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 * - Accepts GMT calendar-annotated PlainDate strings — E5 (issue #78). Ordering is
 *   calendar-independent, so `start`/`end` may carry different or no calendar tags (D4).
 *
 * @param start ISO 8601 date string (interval start), optionally calendar-annotated
 * @param end ISO 8601 date string (interval end), optionally calendar-annotated
 * @returns true if start and end form a valid date interval, or false on invalid input
 *
 * @example isValidDateInterval("2024-01-01", "2024-12-31") // true
 * @example isValidDateInterval("2024-01-01", "2024-01-01") // true
 * @example isValidDateInterval("2024-12-31", "2024-01-01") // false
 * @example isValidDateInterval("invalid", "2024-12-31") // false
 * @example isValidDateInterval("5785-01-01[u-ca=hebrew]", "2024-12-31") // true (mixed calendars — ordering is calendar-independent)
 */
export function isValidDateInterval(start: string, end: string): boolean {
  if (typeof start !== "string" || typeof end !== "string") {
    return false;
  }

  if (!isValidCalendarDate(start) || !isValidCalendarDate(end)) {
    return false;
  }

  try {
    return (
      Temporal.PlainDate.compare(
        parseCalendarDateValue(start),
        parseCalendarDateValue(end),
      ) <= 0
    );
  } catch {
    return false;
  }
}
