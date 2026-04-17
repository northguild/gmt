import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the minute (0-59) for a given ISO 8601 datetime string.
 *
 * - Returns zero-padded string for minute.
 * - Returns "" for invalid input.
 *
 * @param value ISO datetime string
 * @returns Minute (00-59) or "" on invalid input
 *
 * @example parseMinuteFromDateTime("2024-03-15T14:30:45") // "30"
 * @example parseMinuteFromDateTime("2024-03-15T14:00:00") // "00"
 * @example parseMinuteFromDateTime("invalid") // ""
 */
export function parseMinuteFromDateTime(value: string): string {
  if (!isValidDateTime(value)) return "";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime.minute.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
