import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return the minute (0-59) from a UTC datetime string.
 *
 * - Returns zero-padded string for minute.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @returns Minute (00-59) or "" on invalid input
 *
 * @example parseMinuteFromUtc("2024-03-17T14:30:45Z") // "30"
 * @example parseMinuteFromUtc("invalid") // ""
 */
export function parseMinuteFromUtc(value: string): string {
  if (!isValidUtc(value)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");
    return dateTime.minute.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
