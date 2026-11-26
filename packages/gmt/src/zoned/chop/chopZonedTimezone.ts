import { zonedDateTimeOf } from "../../internal/zonedWallClock";

/**
 * Returns the local plain datetime (date + time) extracted from a zoned datetime string.
 *
 * - Extracts both date and time components from a ZonedDateTime.
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @returns Local plain datetime string or "" for invalid
 *
 * @example chopZonedTimezone("2024-02-29T14:30:45.123+05:30[Asia/Kolkata]") // "2024-02-29T14:30:45.123"
 * @example chopZonedTimezone("invalid") // ""
 */
export function chopZonedTimezone(value: string): string {
  const zonedDateTime = zonedDateTimeOf(value);
  if (zonedDateTime === null) return "";
  try {
    return zonedDateTime.toPlainDateTime().toString();
  } catch {
    return "";
  }
}
