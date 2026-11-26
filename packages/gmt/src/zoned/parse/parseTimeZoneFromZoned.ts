import { zonedDateTimeOf } from "../../internal/zonedWallClock";

/**
 * Extract the IANA timeZone identifier from an ISO 8601 zoned datetime string.
 *
 * - Extracts timeZone id from a ZonedDateTime.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns IANA timeZone id or "" when invalid
 *
 * @example parseTimeZoneFromZoned("2024-02-29T12:34:56.789+00:00[UTC]") // "UTC"
 * @example parseTimeZoneFromZoned("invalid") // ""
 */
export function parseTimeZoneFromZoned(value: string): string {
  const zonedDateTime = zonedDateTimeOf(value);
  if (zonedDateTime === null) {
    return "";
  }
  try {
    return zonedDateTime.timeZoneId ?? "";
  } catch {
    return "";
  }
}
