import { plainDateOf } from "../../internal/inputChecks";

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
  const date = plainDateOf(value);
  if (date === null) return "";

  try {
    return date.day.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
