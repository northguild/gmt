import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "./getSystemTimeZone";

/**
 * Return the current second using the system timeZone.
 *
 * - Uses Temporal.Now.plainDateTimeISO to get current second in system timezone.
 * - Returns zero-padded string (e.g., "45").
 * - Returns "" when system timezone is unavailable.
 *
 * @returns current second string (zero-padded) or "" on invalid
 *
 * @example getSecond() // "00"
 * @example getSecond() // "" (when system timeZone unavailable)
 */
export function getSecond(): string {
  const timeZone = getSystemTimeZone();
  if (!timeZone) {
    return "";
  }

  try {
    const now = Temporal.Now.plainDateTimeISO(timeZone);
    return now.second.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
