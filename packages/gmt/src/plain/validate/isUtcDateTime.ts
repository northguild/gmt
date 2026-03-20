import { utcDateTime } from "../../regex/utc-date-time";
import { isLeapSecond } from "./isLeapSecond";

/**
 * Validates whether a string is a valid ISO 8601 UTC datetime.
 * @param value The string to validate
 * @returns `true` if the string is a valid UTC datetime (e.g. "2024-02-29T14:30:45Z"), `false` otherwise
 */
export function isUtcDateTime(value: string): boolean {
  if (isLeapSecond(value)) {
    return false;
  }
  return utcDateTime.test(value);
}
