import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../../validate";

/**
 * Return true if `start` and `end` form a valid datetime interval — both parseable as
 * ISO PlainDateTime strings and `start <= end`.
 *
 * - Both inputs must be ISO 8601 datetime strings (e.g. `"2024-01-01T10:00:00"`).
 * - Equal `start === end` is valid.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 * - Each endpoint must satisfy `isValidDateTime`, so annotations are read as Temporal reads them: a time
 *   zone annotation (`[Europe/Paris]`), `[u-ca=iso8601]` and an elective annotation (`[foo=bar]`) are
 *   ignored; an unknown critical annotation (`[!foo=bar]`) and a non-ISO calendar is rejected.
 *
 * @param start ISO 8601 datetime string (interval start)
 * @param end ISO 8601 datetime string (interval end)
 * @returns true if start and end form a valid datetime interval, or false on invalid input
 *
 * @example isValidDateTimeInterval("2024-01-01T10:00:00", "2024-12-31T23:59:59") // true
 * @example isValidDateTimeInterval("2024-01-01T10:00:00", "2024-01-01T10:00:00") // true
 * @example isValidDateTimeInterval("2024-12-31T23:59:59", "2024-01-01T10:00:00") // false
 * @example isValidDateTimeInterval("invalid", "2024-12-31T23:59:59") // false
 * @example isValidDateTimeInterval("2024-01-01T09:00:00[u-ca=iso8601]", "2024-01-01T17:00:00[foo=bar]") // true (annotations ignored)
 * @example isValidDateTimeInterval("2024-01-01T09:00:00[u-ca=hebrew]", "2024-01-01T17:00:00") // false (non-ISO calendar)
 */
export function isValidDateTimeInterval(start: string, end: string): boolean {
  if (typeof start !== "string" || typeof end !== "string") {
    return false;
  }

  if (!isValidDateTime(start) || !isValidDateTime(end)) {
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
