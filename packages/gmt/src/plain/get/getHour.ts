import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { nowPlainDateTimeISO } from "../../internal/temporalCompat";

/**
 * Return the current hour using the system timeZone.
 *
 * - Uses nowPlainDateTimeISO() to get current hour in system timezone.
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
    const now = nowPlainDateTimeISO(timeZone);
    return now.hour.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
