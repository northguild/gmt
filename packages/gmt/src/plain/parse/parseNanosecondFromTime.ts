import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "../validate";

/**
 * Return the nanosecond (0-999) for a given ISO 8601 time string.
 *
 * - Returns zero-padded string for nanosecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO time string
 * @returns Nanosecond (000-999) or "" on invalid input
 *
 * @example parseNanosecondFromTime("12:30:45.123") // "123"
 * @example parseNanosecondFromTime("12:30:45.000") // "000"
 * @example parseNanosecondFromTime("invalid") // ""
 */
export function parseNanosecondFromTime(value: string): string {
  if (!isValidTime(value)) return "";

  try {
    const time = Temporal.PlainTime.from(value);
    return time.nanosecond.toString().padStart(3, "0");
  } catch {
    return "";
  }
}
