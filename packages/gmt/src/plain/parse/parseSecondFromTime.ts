import { Temporal } from "@js-temporal/polyfill";
import { isValidTime } from "../validate";

/**
 * Return the second (0-59) for a given ISO 8601 time string.
 *
 * - Returns zero-padded string for second.
 * - Returns "" for invalid input.
 *
 * @param value ISO time string
 * @returns Second (00-59) or "" on invalid input
 *
 * @example parseSecondFromTime("12:30:45") // "45"
 * @example parseSecondFromTime("12:00:00") // "00"
 * @example parseSecondFromTime("invalid") // ""
 */
export function parseSecondFromTime(value: string): string {
  if (!isValidTime(value)) return "";

  try {
    const time = Temporal.PlainTime.from(value);
    return time.second.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
