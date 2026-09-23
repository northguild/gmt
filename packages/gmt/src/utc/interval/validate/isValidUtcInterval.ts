import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../../validate";

/**
 * Return true if `start` and `end` form a valid UTC interval — both parseable as
 * ISO UTC datetime strings and the instant at `start` is <= the instant at `end`.
 *
 * - Both inputs must be ISO 8601 UTC datetime strings (e.g. `"2024-01-01T10:00:00Z"`).
 * - Equal `start === end` is valid.
 * - Leap-second strings return `false`.
 * - Invalid input or malformed strings return `false`.
 * - Each endpoint must satisfy `isValidUtc`, so annotations are read as `Temporal.Instant.from` reads
 *   them: a time zone annotation (`[Asia/Tokyo]`), any calendar annotation and an elective annotation
 *   (`[foo=bar]`) are ignored; an unknown critical annotation (`[!foo=bar]`) is rejected.
 *
 * @param start ISO 8601 UTC datetime string (interval start)
 * @param end ISO 8601 UTC datetime string (interval end)
 * @returns true if start and end form a valid UTC interval, or false on invalid input
 *
 * @example isValidUtcInterval("2024-01-01T10:00:00Z", "2024-12-31T23:59:59Z") // true
 * @example isValidUtcInterval("2024-01-01T10:00:00Z", "2024-01-01T10:00:00Z") // true
 * @example isValidUtcInterval("2024-12-31T23:59:59Z", "2024-01-01T10:00:00Z") // false
 * @example isValidUtcInterval("invalid", "2024-12-31T23:59:59Z") // false
 * @example isValidUtcInterval("2024-01-01T10:00:00Z[u-ca=hebrew]", "2024-12-31T23:59:59Z[foo=bar]") // true (annotations ignored)
 * @example isValidUtcInterval("2024-01-01T10:00:00Z[!foo=bar]", "2024-12-31T23:59:59Z") // false (unknown critical annotation)
 */
export function isValidUtcInterval(start: string, end: string): boolean {
  if (typeof start !== "string" || typeof end !== "string") {
    return false;
  }

  if (!isValidUtc(start) || !isValidUtc(end)) {
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
