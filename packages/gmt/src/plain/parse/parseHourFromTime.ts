import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "../validate";

/**
 * Return the hour (0-23) for a given ISO 8601 time string.
 *
 * - Returns zero-padded string for hour.
 * - Returns "" for invalid input.
 *
 * @param value ISO time string
 * @returns Hour (00-23) or "" on invalid input
 *
 * @example parseHourFromTime("12:30:00") // "12"
 * @example parseHourFromTime("invalid") // ""
 */
export function parseHourFromTime(value: string): string {
  if (!isValidTime(value)) return "";

  try {
    const time = Temporal.PlainTime.from(value);
    return time.hour.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
