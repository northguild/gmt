import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return the month (1-12) from a UTC datetime string.
 *
 * - Returns zero-padded string for month.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @returns Month (01-12) or "" on invalid input
 *
 * @example parseMonthFromUtc("2024-03-17T14:30:45Z") // "03"
 * @example parseMonthFromUtc("invalid") // ""
 */
export function parseMonthFromUtc(value: string): string {
  if (!isValidUtc(value)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");
    return dateTime.month.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
