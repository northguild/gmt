import { Temporal } from "@js-temporal/polyfill";

/**
 * Return true if `value` is a valid ISO 8601 duration string.
 *
 * - Uses Temporal.Duration.from to validate.
 * - Accepts date, time, and combined durations, including negative and fractional units.
 *
 * @param value ISO 8601 duration string
 * @returns true if value is a valid ISO 8601 duration string, or false on invalid input
 *
 * @example isValidDuration("P1DT2H30M") // true
 * @example isValidDuration("PT0S") // true
 * @example isValidDuration("-P1D") // true
 * @example isValidDuration("not a duration") // false
 * @example isValidDuration("") // false
 */
export function isValidDuration(value: string): boolean {
  if (typeof value !== "string") {
    return false;
  }

  try {
    Temporal.Duration.from(value);
    return true;
  } catch {
    return false;
  }
}
