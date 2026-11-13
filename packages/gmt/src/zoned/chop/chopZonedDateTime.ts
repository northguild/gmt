import { zonedDateTimeOf } from "../../internal/zonedWallClock";

/**
 * Extracts the IANA timeZone identifier from an ISO 8601 zoned datetime string.
 *
 * - Extracts timezone id from a ZonedDateTime.
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @returns IANA timeZone id (e.g. Europe/Paris) or "" for invalid
 *
 * @example chopZonedDateTime("2024-02-29T12:30:45+01:00[Europe/Paris]") // "Europe/Paris"
 * @example chopZonedDateTime("invalid") // ""
 */
export function chopZonedDateTime(value: string): string {
  const zonedDateTime = zonedDateTimeOf(value);
  if (zonedDateTime === null) return "";
  try {
    return zonedDateTime.timeZoneId;
  } catch {
    return "";
  }
}
