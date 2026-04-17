import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return whether `value1` represents an instant strictly before `value2`.
 *
 * - Both inputs must be valid zoned ISO 8601 datetime strings.
 * - Comparison is performed using Temporal.Instant (same instant semantics), so differing timeZone representations but the same instant will compare as equal.
 * - Invalid inputs return `false`.
 *
 * @param value1 first zoned datetime string
 * @param value2 second zoned datetime string
 * @returns `true` if `value1` is before `value2`, otherwise `false`
 *
 * @example isBeforeZoned("2024-03-17T14:30:45-05:00[America/New_York]", "2024-03-17T15:30:45-05:00[America/New_York]") // true
 * @example isBeforeZoned("invalid", "2024-03-17T14:30:45-05:00[America/New_York]") // false
 */
export function isBeforeZoned(value1: string, value2: string): boolean {
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
      ) === -1
    );
  } catch {
    return false;
  }
}
