import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

/**
 * Return the microsecond (0-999) from a UTC datetime string.
 *
 * - Returns zero-padded string for microsecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45.123Z")
 * @returns Microsecond (000-999) or "" on invalid input
 *
 * @example parseMicrosecondFromUtc("2024-03-17T14:30:45.123Z") // "123"
 * @example parseMicrosecondFromUtc("invalid") // ""
 */
export function parseMicrosecondFromUtc(value: string): string {
  if (!isValidUtc(value)) return "";

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");
    return (dateTime.microsecond ?? 0).toString().padStart(3, "0");
  } catch {
    return "";
  }
}
