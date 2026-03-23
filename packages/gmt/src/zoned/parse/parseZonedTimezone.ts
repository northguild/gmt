import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Extract the IANA timezone identifier from an ISO 8601 zoned datetime
 * string.
 *
 * - Returns empty string "" for invalid zoned datetime inputs.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns IANA timezone id or empty string when invalid
 */
export function parseZonedTimezone(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  return Temporal.ZonedDateTime.from(value).timeZoneId ?? "";
}
