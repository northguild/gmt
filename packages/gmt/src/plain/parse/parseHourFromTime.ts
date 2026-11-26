import { plainTimeOf } from "../../internal/inputChecks";

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
  const time = plainTimeOf(value);
  if (time === null) return "";

  try {
    return time.hour.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
