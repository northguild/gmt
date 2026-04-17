import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "../validate";

/**
 * Return the microsecond (0-999) for a given ISO 8601 time string.
 *
 * @param value ISO time string
 * @returns Microsecond (000-999) or "" on invalid input
 *
 * @example parseMicrosecondFromTime("12:30:45.123") // "123"
 * @example parseMicrosecondFromTime("12:30:45.000") // "000"
 * @example parseMicrosecondFromTime("invalid") // ""
 */
export function parseMicrosecondFromTime(value: string): string {
  if (!isValidTime(value)) return "";

  try {
    const time = Temporal.PlainTime.from(value);
    return time.microsecond.toString().padStart(3, "0");
  } catch {
    return "";
  }
}
