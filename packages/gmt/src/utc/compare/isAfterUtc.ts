import { Temporal } from "../../internal/temporal";
import { utcInstantOf } from "../../internal/utcInstant";

/**
 * Return whether `value1` represents an instant strictly after `value2`.
 *
 * - Uses Temporal.Instant.compare for comparison.
 * - Returns false if either input is invalid.
 *
 * @param value1 first UTC datetime string
 * @param value2 second UTC datetime string
 * @returns `true` if `value1` is after `value2`, otherwise `false`
 *
 * @example isAfterUtc("2024-03-17T15:30:45Z", "2024-03-17T14:30:45Z") // true
 * @example isAfterUtc("2024-03-17T14:30:45Z", "2024-03-17T14:30:45Z") // false
 * @example isAfterUtc("2024-03-17T14:30:45Z", "invalid") // false
 */
export function isAfterUtc(value1: string, value2: string): boolean {
  const instant1 = utcInstantOf(value1);
  if (instant1 === null) {
    return false;
  }

  const instant2 = utcInstantOf(value2);
  if (instant2 === null) {
    return false;
  }

  try {
    return Temporal.Instant.compare(instant1, instant2) === 1;
  } catch {
    return false;
  }
}
