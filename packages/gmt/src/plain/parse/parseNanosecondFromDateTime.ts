import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the nanosecond (0-999) for a given ISO 8601 datetime string.
 *
 * - Returns zero-padded string for nanosecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO datetime string
 * @returns Nanosecond (000-999) or "" on invalid input
 *
 * @example parseNanosecondFromDateTime("2024-03-15T14:30:45.123") // "123"
 * @example parseNanosecondFromDateTime("2024-03-15T14:30:45.000") // "000"
 * @example parseNanosecondFromDateTime("invalid") // ""
 */
export function parseNanosecondFromDateTime(value: string): string {
  if (!isValidDateTime(value)) return "";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime.nanosecond.toString().padStart(3, "0");
  } catch {
    return "";
  }
}
