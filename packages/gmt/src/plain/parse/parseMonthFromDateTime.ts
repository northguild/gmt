import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the month (1-12) for a given ISO 8601 datetime string.
 *
 * - Returns zero-padded string for month.
 * - Returns "" for invalid input.
 *
 * @param value ISO datetime string
 * @returns Month (01-12) or "" on invalid input
 *
 * @example parseMonthFromDateTime("2024-03-15T12:30:00") // "03"
 * @example parseMonthFromDateTime("invalid") // ""
 */
export function parseMonthFromDateTime(value: string): string {
  if (!isValidDateTime(value)) return "";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime.month.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
