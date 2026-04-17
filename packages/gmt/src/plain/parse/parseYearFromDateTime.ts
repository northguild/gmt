import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the year for a given ISO 8601 datetime string.
 *
 * - Returns the year as a string (e.g., "2024").
 * - Returns "" for invalid input.
 *
 * @param value ISO datetime string
 * @returns Year (YYYY) or "" on invalid input
 *
 * @example parseYearFromDateTime("2024-03-15T12:30:00") // "2024"
 * @example parseYearFromDateTime("invalid") // ""
 */
export function parseYearFromDateTime(value: string): string {
  if (!isValidDateTime(value)) return "";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime.year.toString();
  } catch {
    return "";
  }
}
