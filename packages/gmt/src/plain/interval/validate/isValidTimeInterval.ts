import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "../../validate";

/**
 * Return true if `start` and `end` form a valid time interval — both parseable as
 * ISO PlainTime strings and `start <= end`.
 *
 * - Both inputs must be ISO 8601 time strings (e.g. `"14:30:00"`).
 * - Equal `start === end` is valid.
 * - Invalid input, malformed strings, or leap-second strings return `false`.
 * - Each endpoint must satisfy `isValidTime`, so annotations are read as Temporal reads them: a time
 *   zone annotation (`[Europe/Paris]`), `[u-ca=iso8601]` and an elective annotation (`[foo=bar]`) are
 *   ignored; an unknown critical annotation (`[!foo=bar]`) is rejected.
 *
 * @param start ISO 8601 time string (interval start)
 * @param end ISO 8601 time string (interval end)
 * @returns true if start and end form a valid time interval, or false on invalid input
 *
 * @example isValidTimeInterval("09:00:00", "17:00:00") // true
 * @example isValidTimeInterval("12:00:00", "12:00:00") // true
 * @example isValidTimeInterval("17:00:00", "09:00:00") // false
 * @example isValidTimeInterval("invalid", "12:00:00") // false
 * @example isValidTimeInterval("09:00:00[u-ca=iso8601]", "17:00:00[foo=bar]") // true (annotations ignored)
 * @example isValidTimeInterval("09:00:00[!foo=bar]", "17:00:00") // false (unknown critical annotation)
 */
export function isValidTimeInterval(start: string, end: string): boolean {
  if (typeof start !== "string" || typeof end !== "string") {
    return false;
  }

  if (!isValidTime(start) || !isValidTime(end)) {
    return false;
  }

  try {
    return (
      Temporal.PlainTime.compare(
        Temporal.PlainTime.from(start),
        Temporal.PlainTime.from(end),
      ) <= 0
    );
  } catch {
    return false;
  }
}
