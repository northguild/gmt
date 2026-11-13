import { zonedDateTimeOf } from "../../internal/zonedWallClock";

/**
 * Extracts the local date portion from an ISO 8601 zoned datetime string.
 *
 * - Extracts date components (year, month, day) from a ZonedDateTime.
 * - Returns "" for invalid input.
 *
 * @param value ISO 8601 zoned datetime string
 * @returns Local date string YYYY-MM-DD or "" for invalid
 *
 * @example chopZonedTime("2024-02-29T14:30:45.123-03:00[America/Sao_Paulo]") // "2024-02-29"
 * @example chopZonedTime("invalid") // ""
 */
export function chopZonedTime(value: string): string {
  const zonedDateTime = zonedDateTimeOf(value);
  if (zonedDateTime === null) return "";
  try {
    return zonedDateTime.toPlainDate().toString();
  } catch {
    return "";
  }
}
