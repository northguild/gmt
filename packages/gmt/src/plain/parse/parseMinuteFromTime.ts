import { plainTimeOf } from "../../internal/inputChecks";

/**
 * Return the minute (0-59) for a given ISO 8601 time string.
 *
 * - Returns zero-padded string for minute.
 * - Returns "" for invalid input.
 *
 * @param value ISO time string
 * @returns Minute (00-59) or "" on invalid input
 *
 * @example parseMinuteFromTime("12:30:00") // "30"
 * @example parseMinuteFromTime("12:00:00") // "00"
 * @example parseMinuteFromTime("invalid") // ""
 */
export function parseMinuteFromTime(value: string): string {
  const time = plainTimeOf(value);
  if (time === null) return "";

  try {
    return time.minute.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
