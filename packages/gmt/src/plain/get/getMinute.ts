import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "./getSystemTimeZone";

/**
 * Return the current minute using the system timeZone.
 *
 * - Uses Temporal.Now.plainDateTimeISO to get current minute in system timezone.
 * - Returns zero-padded string (e.g., "30").
 * - Returns "" when system timezone is unavailable.
 *
 * @returns current minute string (zero-padded) or "" on invalid
 *
 * @example getMinute() // "00"
 * @example getMinute() // "" (when system timeZone unavailable)
 */
export function getMinute(): string {
  const timeZone = getSystemTimeZone();
  if (!timeZone) {
    return "";
  }

  try {
    const now = Temporal.Now.plainDateTimeISO(timeZone);
    return now.minute.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
