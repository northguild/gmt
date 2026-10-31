import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { nowPlainDateTimeISO } from "../../internal/temporalCompat";

/**
 * Return the current minute using the system timeZone.
 *
 * - Uses nowPlainDateTimeISO() to get current minute in system timezone.
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
    const now = nowPlainDateTimeISO(timeZone);
    return now.minute.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
