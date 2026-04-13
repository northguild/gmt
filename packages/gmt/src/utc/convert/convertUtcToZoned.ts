import { Temporal } from "@js-temporal/polyfill";
import { isValidTimeZone } from "../../zoned/validate";
import { isValidUtc } from "../validate";

/**
 * Convert a UTC Instant string to a zoned ISO 8601 datetime string in the
 * specified `timeZone`.
 *
 * - `value` must be a parseable UTC Instant string.
 * - `timeZone` must be a valid IANA timeZone id.
 * - Returns empty string "" for invalid inputs.
 *
 * @param value UTC Instant string
 * @param timeZone IANA timeZone identifier
 * @returns zoned ISO 8601 string or empty string when invalid
 */
export function convertUtcToZoned(value: string, timeZone: string): string {
  if (!isValidUtc(value) || !isValidTimeZone(timeZone)) {
    return "";
  }

  try {
    return Temporal.Instant.from(value).toZonedDateTimeISO(timeZone).toString();
  } catch {
    return "";
  }
}
