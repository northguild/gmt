import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

/**
 * Validate whether a string is a valid ISO 8601 zoned datetime string.
 *
 * - Rejects non-strings, empty strings, and leap-second inputs.
 * - Uses `Temporal.ZonedDateTime.from` to verify parseability and ensures a
 *   non-empty timezone id is present.
 * - Returns `true` for valid zoned datetimes, otherwise `false`.
 *
 * @param value candidate zoned datetime string
 * @returns boolean indicating validity
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
