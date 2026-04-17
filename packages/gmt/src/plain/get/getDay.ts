import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "./getSystemTimeZone";

/**
 * Return the current day of month using the system timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get current day in system timezone.
 * - Returns zero-padded string (e.g., "29").
 * - Returns "" when system timezone is unavailable.
 *
 * @returns current day string (zero-padded) or "" on invalid
 *
 * @example getDay() // "29"
 * @example getDay() // "" (when system timeZone unavailable)
 */
export function getDay(): string {
  const timeZone = getSystemTimeZone();
  if (!timeZone) return "";

  try {
    return Temporal.Now.zonedDateTimeISO(timeZone)
      .day.toString()
      .padStart(2, "0");
  } catch {
    return "";
  }
}
