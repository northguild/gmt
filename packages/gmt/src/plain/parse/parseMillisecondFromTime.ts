import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "../validate";

/**
 * Return the millisecond (0-999) for a given ISO 8601 time string.
 *
 * - Returns zero-padded string for millisecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO time string
 * @returns Millisecond (000-999) or "" on invalid input
 *
 * @example parseMillisecondFromTime("12:30:45.123") // "123"
 * @example parseMillisecondFromTime("12:30:45.000") // "000"
 * @example parseMillisecondFromTime("invalid") // ""
 */
export function parseMillisecondFromTime(value: string): string {
  if (!isValidTime(value)) return "";

  try {
    const time = Temporal.PlainTime.from(value);
    return time.millisecond.toString().padStart(3, "0");
  } catch {
    return "";
  }
}
