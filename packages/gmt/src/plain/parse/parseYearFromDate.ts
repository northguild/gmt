import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";
import { isoYearString } from "../../internal/isoYearString";

/**
 * Return the year for a given ISO 8601 date string.
 *
 * - Returns the year as Temporal writes it: four digits (`"2024"`, `"0005"`), or a sign and six
 *   digits outside 0000–9999 (`"+010000"`, `"-000005"`).
 * - Returns "" for invalid input.
 *
 * @param value ISO date string
 * @returns the year as four digits, or a sign and six digits outside 0000–9999, or "" on invalid input
 *
 * @example parseYearFromDate("2024-03-15") // "2024"
 * @example parseYearFromDate("0005-06-01") // "0005"
 * @example parseYearFromDate("+010000-01-01") // "+010000"
 * @example parseYearFromDate("invalid") // ""
 */
export function parseYearFromDate(value: string): string {
  if (!isValidDate(value)) return "";

  try {
    const date = Temporal.PlainDate.from(value);
    return isoYearString(date.year);
  } catch {
    return "";
  }
}
