import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return the second (0-59) from a UTC datetime string.
 *
 * - Returns zero-padded string for second.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @returns Second (00-59) or "" on invalid input
 *
 * @example parseSecondFromUtc("2024-03-17T14:30:45Z") // "45"
 * @example parseSecondFromUtc("invalid") // ""
 */
export function parseSecondFromUtc(value: string): string {
  if (!isValidUtc(value)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");
    return dateTime.second.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
