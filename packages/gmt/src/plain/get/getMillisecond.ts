import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { nowPlainDateTimeISO } from "../../internal/temporalCompat";

/**
 * Return the current millisecond using the system timeZone.
 *
 * - Uses nowPlainDateTimeISO() to get current millisecond in system timezone.
 * - Returns zero-padded string to 3 digits (e.g., "123").
 * - Returns "" when system timezone is unavailable.
 *
 * @returns current millisecond string (zero-padded to 3 digits) or "" on invalid
 *
 * @example getMillisecond() // "000"
 * @example getMillisecond() // "" (when system timeZone unavailable)
 */
export function getMillisecond(): string {
  const timeZone = getSystemTimeZone();
  if (!timeZone) {
    return "";
  }

  try {
    const now = nowPlainDateTimeISO(timeZone);
    return (now.millisecond ?? 0).toString().padStart(3, "0");
  } catch {
    return "";
  }
}
