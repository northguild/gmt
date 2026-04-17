import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return the year from a UTC datetime string.
 *
 * - Returns the year as a string (e.g., "2024").
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @returns Year (YYYY) or "" on invalid input
 *
 * @example parseYearFromUtc("2024-03-17T14:30:45Z") // "2024"
 * @example parseYearFromUtc("invalid") // ""
 */
export function parseYearFromUtc(value: string): string {
  if (!isValidUtc(value)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");
    return dateTime.year.toString();
  } catch {
    return "";
  }
}
