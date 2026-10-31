import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { nowPlainDateTimeISO } from "../../internal/temporalCompat";

/**
 * Return the current second using the system timeZone.
 *
 * - Uses nowPlainDateTimeISO() to get current second in system timezone.
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
    const now = nowPlainDateTimeISO(timeZone);
    return now.second.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
