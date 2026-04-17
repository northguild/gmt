import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

/**
 * Return the day of month (1-31) for a given ISO 8601 date string.
 *
 * - Returns zero-padded string for day.
 * - Returns "" for invalid input.
 *
 * @param value ISO date string
 * @returns Day (01-31) or "" on invalid input
 *
 * @example parseDayFromDate("2024-03-15") // "15"
 * @example parseDayFromDate("invalid") // ""
 */
export function parseDayFromDate(value: string): string {
  if (!isValidDate(value)) return "";

  try {
    const date = Temporal.PlainDate.from(value);
    return date.day.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
