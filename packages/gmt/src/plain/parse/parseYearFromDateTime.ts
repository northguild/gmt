import { plainDateTimeOf } from "../../internal/inputChecks";
import { isoYearString } from "../../internal/isoYearString";

/**
 * Return the year for a given ISO 8601 datetime string.
 *
 * - Returns the year as Temporal writes it: four digits (`"2024"`, `"0005"`), or a sign and six
 *   digits outside 0000–9999 (`"+010000"`, `"-000005"`).
 * - Returns "" for invalid input.
 *
 * @param value ISO datetime string
 * @returns the year as four digits, or a sign and six digits outside 0000–9999, or "" on invalid input
 *
 * @example parseYearFromDateTime("2024-03-15T12:30:00") // "2024"
 * @example parseYearFromDateTime("0005-06-01T12:30:00") // "0005"
 * @example parseYearFromDateTime("invalid") // ""
 */
export function parseYearFromDateTime(value: string): string {
  const dateTime = plainDateTimeOf(value);
  if (dateTime === null) return "";

  try {
    return isoYearString(dateTime.year);
  } catch {
    return "";
  }
}
