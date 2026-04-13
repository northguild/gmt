import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return true when the provided string is a valid ISO 8601 UTC datetime.
 *
 * - Rejects leap-seconds explicitly.
 * - Uses a regex to validate the UTC datetime format.
 * - Uses Temporal.Instant.from for strong validation.
 *
 * @param value input UTC datetime string (ISO 8601)
 * @example isValidUtc("2024-03-17T14:30:45Z") // true
 * @example isValidUtc("2024-12-31T23:59:60Z") // false (leap second)
 * @example isValidUtc("invalid") // false
 * @returns boolean indicating whether the input is a valid UTC datetime
 */
export function isValidUtc(value: string): boolean {
  if (isLeapSecond(value)) {
    return false;
  }

  // need to NOT just do regex test but ALSO proper validation test
  if (!utcDateTime.test(value)) {
    return false;
  }

  try {
    Temporal.Instant.from(value);
    return true;
  } catch {
    return false;
  }
}
