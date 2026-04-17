import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "./getSystemTimeZone";

/**
 * Return the current hour using the system timeZone.
 *
 * - Uses Temporal.Now.plainDateTimeISO to get current hour in system timezone.
 * - Returns zero-padded string (e.g., "14").
 * - Returns "" when system timezone is unavailable.
 *
 * @returns current hour string (zero-padded) or "" on invalid
 *
 * @example getHour() // "00"
 * @example getHour() // "" (when system timeZone unavailable)
 */
export function getHour(): string {
  const timeZone = getSystemTimeZone();
  if (!timeZone) {
    return "";
  }

  try {
    const now = Temporal.Now.plainDateTimeISO(timeZone);
    return now.hour.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
