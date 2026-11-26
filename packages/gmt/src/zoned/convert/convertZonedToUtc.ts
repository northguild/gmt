import { zonedDateTimeOf } from "../../internal/zonedWallClock";

/**
 * Convert an ISO 8601 zoned datetime string to a UTC Instant string (ISO).
 *
 * - Uses Temporal.ZonedDateTime.toInstant to convert.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @returns UTC Instant ISO string or "" when invalid
 *
 * @example convertZonedToUtc("2024-02-29T12:34:56.789+00:00[UTC]") // "2024-02-29T12:34:56.789Z"
 * @example convertZonedToUtc("invalid") // ""
 */
export function convertZonedToUtc(value: string): string {
  const zonedDateTime = zonedDateTimeOf(value);
  if (zonedDateTime === null) {
    return "";
  }

  try {
    return zonedDateTime.toInstant().toString();
  } catch {
    return "";
  }
}
