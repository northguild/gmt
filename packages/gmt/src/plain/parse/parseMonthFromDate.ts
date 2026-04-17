import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../validate";

/**
 * Return the month (1-12) for a given ISO 8601 date string.
 *
 * - Returns zero-padded string for month.
 * - Returns "" for invalid input.
 *
 * @param value ISO date string
 * @returns Month (01-12) or "" on invalid input
 *
 * @example parseMonthFromDate("2024-03-15") // "03"
 * @example parseMonthFromDate("invalid") // ""
 */
export function parseMonthFromDate(value: string): string {
  if (!isValidDate(value)) return "";

  try {
    const date = Temporal.PlainDate.from(value);
    return date.month.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
