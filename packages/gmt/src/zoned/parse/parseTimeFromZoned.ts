import { zonedDateTimeOf } from "../../internal/zonedWallClock";

/**
 * Extract the plain time portion from an ISO 8601 zoned datetime string.
 *
 * - Extracts time components from a ZonedDateTime.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns plain time string (HH:mm:ss[.sss]) or "" when invalid
 *
 * @example parseTimeFromZoned("2024-02-29T12:34:56.789+00:00[UTC]") // "12:34:56.789"
 * @example parseTimeFromZoned("invalid") // ""
 */
export function parseTimeFromZoned(value: string): string {
  const zonedDateTime = zonedDateTimeOf(value);
  if (zonedDateTime === null) {
    return "";
  }

  try {
    return zonedDateTime?.toPlainTime().toString();
  } catch {
    return "";
  }
}
