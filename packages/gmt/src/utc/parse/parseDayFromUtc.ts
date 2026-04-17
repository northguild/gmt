import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return the day of month (1-31) from a UTC datetime string.
 *
 * - Returns zero-padded string for day.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @returns Day (01-31) or "" on invalid input
 *
 * @example parseDayFromUtc("2024-03-17T14:30:45Z") // "17"
 * @example parseDayFromUtc("invalid") // ""
 */
export function parseDayFromUtc(value: string): string {
  if (!isValidUtc(value)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");
    return dateTime.day.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
