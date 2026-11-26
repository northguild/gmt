import { isoYearString } from "../../internal/isoYearString";
import { zonedDateTimeOf } from "../../internal/zonedWallClock";

/**
 * Return the year for a given ISO 8601 zoned datetime string.
 *
 * - Returns the year as Temporal writes it: four digits (`"2024"`, `"0005"`), or a sign and six
 *   digits outside 0000–9999 (`"+010000"`, `"-000005"`).
 * - Returns "" for invalid input.
 *
 * @param value ISO zoned datetime string
 * @returns the year as four digits, or a sign and six digits outside 0000–9999, or "" on invalid input
 *
 * @example parseYearFromZoned("2024-03-15T14:30:45.123+00:00[UTC]") // "2024"
 * @example parseYearFromZoned("0005-06-01T12:30:00+00:00[UTC]") // "0005"
 * @example parseYearFromZoned("invalid") // ""
 */
export function parseYearFromZoned(value: string): string {
  const zonedDateTime = zonedDateTimeOf(value);
  if (zonedDateTime === null) {
    return "";
  }

  try {
    return isoYearString(zonedDateTime.year);
  } catch {
    return "";
  }
}
