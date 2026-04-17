import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return the millisecond (0-999) from a UTC datetime string.
 *
 * - Returns zero-padded string for millisecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45.123Z")
 * @returns Millisecond (000-999) or "" on invalid input
 *
 * @example parseMillisecondFromUtc("2024-03-17T14:30:45.123Z") // "123"
 * @example parseMillisecondFromUtc("invalid") // ""
 */
export function parseMillisecondFromUtc(value: string): string {
  if (!isValidUtc(value)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");
    return dateTime.millisecond.toString().padStart(3, "0");
  } catch {
    return "";
  }
}
