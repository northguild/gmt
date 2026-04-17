import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Extract the date portion from a UTC datetime string.
 *
 * - Uses Temporal.Instant.from to parse, converts to UTC date.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @returns ISO date string (e.g., "2024-03-17") or "" on invalid input
 *
 * @example parseDateFromUtc("2024-03-17T14:30:45Z") // "2024-03-17"
 * @example parseDateFromUtc("invalid") // ""
 */
export function parseDateFromUtc(value: string): string {
  if (!isValidUtc(value)) {
    return "";
  }

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");
    return dateTime.toPlainDate().toString();
  } catch {
    return "";
  }
}
