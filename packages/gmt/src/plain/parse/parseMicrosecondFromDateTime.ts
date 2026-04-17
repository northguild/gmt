import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate";

/**
 * Return the microsecond (0-999) for a given ISO 8601 datetime string.
 *
 * - Returns zero-padded string for microsecond.
 * - Returns "" for invalid input.
 *
 * @param value ISO datetime string
 * @returns Microsecond (000-999) or "" on invalid input
 *
 * @example parseMicrosecondFromDateTime("2024-03-15T14:30:45.123") // "123"
 * @example parseMicrosecondFromDateTime("2024-03-15T14:30:45.000") // "000"
 * @example parseMicrosecondFromDateTime("invalid") // ""
 */
export function parseMicrosecondFromDateTime(value: string): string {
  if (!isValidDateTime(value)) return "";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);
    return dateTime.microsecond.toString().padStart(3, "0");
  } catch {
    return "";
  }
}
