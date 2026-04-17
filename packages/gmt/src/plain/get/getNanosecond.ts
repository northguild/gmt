import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "./getSystemTimeZone";

/**
 * Return the current nanosecond using the system timeZone.
 *
 * - Uses Temporal.Now.plainDateTimeISO to get current nanosecond in system timezone.
 * - Returns zero-padded string to 3 digits (e.g., "789").
 * - Returns "" when system timezone is unavailable.
 *
 * @returns current nanosecond string (zero-padded to 3 digits) or "" on invalid
 *
 * @example getNanosecond() // "000"
 * @example getNanosecond() // "" (when system timeZone unavailable)
 */
export function getNanosecond(): string {
  const timeZone = getSystemTimeZone();
  if (!timeZone) {
    return "";
  }

  try {
    const now = Temporal.Now.plainDateTimeISO(timeZone);
    return (now.nanosecond ?? 0).toString().padStart(3, "0");
  } catch {
    return "";
  }
}
