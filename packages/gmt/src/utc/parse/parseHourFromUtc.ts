import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return the hour (0-23) from a UTC datetime string.
 *
 * - Returns zero-padded string for hour.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @returns Hour (00-23) or "" on invalid input
 *
 * @example parseHourFromUtc("2024-03-17T14:30:45Z") // "14"
 * @example parseHourFromUtc("invalid") // ""
 */
export function parseHourFromUtc(value: string): string {
  if (!isValidUtc(value)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");
    return dateTime.hour.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
