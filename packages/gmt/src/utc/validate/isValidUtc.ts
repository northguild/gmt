import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate";
import { utcDateTime } from "../../regex/utc-date-time";

/**
 * Return true when the provided string is a valid ISO 8601 UTC datetime.
 *
 * - Uses regex to check format before parsing.
 * - Rejects leap seconds (e.g., "2024-12-31T23:59:60Z").
 * - Uses Temporal.Instant.from for validation.
 * - Requires a time component — date-only strings ("2024-01-01Z") are rejected.
 *
 * @param value input UTC datetime string (ISO 8601)
 * @returns boolean indicating whether the input is a valid UTC datetime
 *
 * @example isValidUtc("2024-03-17T14:30:45Z") // true
 * @example isValidUtc("2024-01-01Z") // false — date-only not supported
 * @example isValidUtc("2024-12-31T23:59:60Z") // false
 * @example isValidUtc("invalid") // false
 */
export function isValidUtc(value: string): boolean {
  if (isLeapSecond(value)) {
    return false;
  }

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
