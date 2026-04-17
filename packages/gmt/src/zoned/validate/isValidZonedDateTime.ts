import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Validate whether a string is a valid ISO 8601 zoned datetime string.
 *
 * - Uses Temporal.ZonedDateTime.from for validation.
 * - Rejects leap seconds.
 * - Returns false for non-strings or empty strings.
 *
 * @param value candidate zoned datetime string
 * @returns boolean indicating validity
 *
 * @example isValidZonedDateTime("2024-02-29T12:34:56.789+00:00[UTC]") // true
 * @example isValidZonedDateTime("2024-06-30T23:59:60+00:00[UTC]") // false (leap second)
 * @example isValidZonedDateTime("invalid") // false
 */
export function isValidZonedDateTime(value: string): boolean {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  if (isLeapSecond(value)) {
    return false;
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.timeZoneId.length > 0;
  } catch {
    return false;
  }
}
