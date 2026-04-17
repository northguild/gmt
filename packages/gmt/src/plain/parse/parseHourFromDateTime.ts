import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the hour (00-23) for a given ISO 8601 datetime string.
 *
 * - Returns zero-padded string for hour.
 * - Returns "" for invalid input.
 *
 * @param value ISO datetime string
 * @returns Hour (00-23) or "" on invalid input
 *
 * @example parseHourFromDateTime("2024-03-15T14:30:00") // "14"
 * @example parseHourFromDateTime("2024-03-15T00:00:00") // "00"
 * @example parseHourFromDateTime("invalid") // ""
 */
export function parseHourFromDateTime(value: string): string {
  if (!isValidDateTime(value)) return "";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime.hour.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
