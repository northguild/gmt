import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the millisecond (0-999) for a given ISO 8601 datetime string.
 *
 * - Returns zero-padded string for millisecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO datetime string
 * @returns Millisecond (000-999) or "" on invalid input
 *
 * @example parseMillisecondFromDateTime("2024-03-15T14:30:45.123") // "123"
 * @example parseMillisecondFromDateTime("2024-03-15T14:30:45.000") // "000"
 * @example parseMillisecondFromDateTime("invalid") // ""
 */
export function parseMillisecondFromDateTime(value: string): string {
  if (!isValidDateTime(value)) return "";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime.millisecond.toString().padStart(3, "0");
  } catch {
    return "";
  }
}
