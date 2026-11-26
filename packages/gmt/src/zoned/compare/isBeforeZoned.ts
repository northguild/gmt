import { Temporal } from "../../internal/temporal";
import { zonedDateTimeOf } from "../../internal/zonedWallClock";

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
 * @example isBeforeZoned("2024-03-17T14:30:45+02:00[Africa/Johannesburg]", "2024-03-17T15:30:45+02:00[Africa/Johannesburg]") // true
 * @example isBeforeZoned("invalid", "2024-03-17T14:30:45+02:00[Africa/Johannesburg]") // false
 */
export function isBeforeZoned(value1: string, value2: string): boolean {
  const zonedDateTime1 = zonedDateTimeOf(value1);
  const zonedDateTime2 = zonedDateTimeOf(value2);
  if (zonedDateTime1 === null || zonedDateTime2 === null) {
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
