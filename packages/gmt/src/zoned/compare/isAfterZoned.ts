import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return whether `value1` represents an instant strictly after `value2`.
 *
 * - Both inputs must be valid zoned ISO 8601 datetime strings.
 * - Comparison is performed using Temporal.Instant (same instant semantics), so differing timeZone representations but the same instant will compare as equal.
 * - Invalid inputs return `false`.
 *
 * @param value1 first zoned datetime string
 * @param value2 second zoned datetime string
 * @returns `true` if `value1` is after `value2`, otherwise `false`
 *
 * @example isAfterZoned("2024-02-29T12:34:56.789+00:00[UTC]", "2024-02-29T12:34:56.788+00:00[UTC]") // true
 * @example isAfterZoned("invalid", "2024-02-29T12:34:56.789+00:00[UTC]") // false
 */
export function isAfterZoned(value1: string, value2: string): boolean {
  if (!isValidZonedDateTime(value1) || !isValidZonedDateTime(value2)) {
    return false;
  }

  let zonedDateTime1: Temporal.ZonedDateTime;
  let zonedDateTime2: Temporal.ZonedDateTime;
  try {
    zonedDateTime1 = Temporal.ZonedDateTime.from(value1);
    zonedDateTime2 = Temporal.ZonedDateTime.from(value2);
  } catch {
    return false;
  }

  try {
    return (
      Temporal.Instant.compare(
        zonedDateTime1.toInstant(),
        zonedDateTime2.toInstant(),
      ) === 1
    );
  } catch {
    return false;
  }
}
