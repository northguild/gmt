import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../../plain/validate";
import { isValidTimezone } from "../validate";

/**
 * Attach the specified `timeZone` to a plain datetime string and return a
 * zoned ISO 8601 datetime string.
 *
 * - `value` must be a plain datetime (no timezone suffix).
 * - Returns empty string "" for invalid inputs.
 *
 * @param value plain datetime string (e.g. "2024-02-29T14:30:45")
 * @param timeZone IANA timezone identifier
 * @returns zoned ISO 8601 datetime string or empty string when invalid
 */
export function getZonedDateTime(value: string, timeZone: string): string {
  if (!isValidDateTime(value) || !isValidTimezone(timeZone)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(`${value}[${timeZone}]`);
    return zonedDateTime.toString();
  } catch {
    return "";
  }
}
