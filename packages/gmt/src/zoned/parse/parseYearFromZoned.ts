import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the year for a given ISO 8601 zoned datetime string.
 *
 * - Returns string for year.
 * - Returns "" for invalid input.
 *
 * @param value ISO zoned datetime string
 * @returns Year as string or "" on invalid input
 *
 * @example parseYearFromZoned("2024-03-15T14:30:45.123+00:00[UTC]") // "2024"
 * @example parseYearFromZoned("invalid") // ""
 */
export function parseYearFromZoned(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.year.toString();
  } catch {
    return "";
  }
}
