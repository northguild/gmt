import { plainDateTimeOf } from "../../internal/inputChecks";

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
  const dateTime = plainDateTimeOf(value);
  if (dateTime === null) return "";

  try {
    return dateTime.day.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
