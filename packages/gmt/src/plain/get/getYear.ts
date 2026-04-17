import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "./getSystemTimeZone";

/**
 * Return the current year as a zero-padded string in the system timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get current year in system timezone.
 * - Returns zero-padded string (e.g., "2024").
 * - Returns "" when system timezone is unavailable.
 *
 * @returns current year string (zero-padded) or "" on invalid
 *
 * @example getYear() // "2024"
 * @example getYear() // "" (when system timeZone unavailable)
 */
export function getYear(): string {
  const timeZone = getSystemTimeZone();
  if (!timeZone) return "";

  try {
    return Temporal.Now.zonedDateTimeISO(timeZone)
      .year.toString()
      .padStart(4, "0");
  } catch {
    return "";
  }
}
