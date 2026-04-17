import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the day of month (1-31) for a given ISO 8601 datetime string.
 *
 * - Returns zero-padded string for day.
 * - Returns "" for invalid input.
 *
 * @param value ISO datetime string
 * @returns Day (01-31) or "" on invalid input
 *
 * @example parseDayFromDateTime("2024-03-15T12:30:00") // "15"
 * @example parseDayFromDateTime("2024-12-31T23:59:59") // "31"
 * @example parseDayFromDateTime("invalid") // ""
 */
export function parseDayFromDateTime(value: string): string {
  if (!isValidDateTime(value)) return "";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime.day.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
