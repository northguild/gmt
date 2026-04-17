import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

/**
 * Return the year for a given ISO 8601 date string.
 *
 * - Returns the year as a string (e.g., "2024").
 * - Returns "" for invalid input.
 *
 * @param value ISO date string
 * @returns Year (YYYY) or "" on invalid input
 *
 * @example parseYearFromDate("2024-03-15") // "2024"
 * @example parseYearFromDate("invalid") // ""
 */
export function parseYearFromDate(value: string): string {
  if (!isValidDate(value)) return "";

  try {
    const date = Temporal.PlainDate.from(value);
    return date.year.toString();
  } catch {
    return "";
  }
}
