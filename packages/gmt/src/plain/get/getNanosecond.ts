import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { nowPlainDateTimeISO } from "../../internal/temporalCompat";

/**
 * Return the current nanosecond using the system timeZone.
 *
 * - Uses nowPlainDateTimeISO() to get current nanosecond in system timezone.
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
    const now = nowPlainDateTimeISO(timeZone);
    return (now.nanosecond ?? 0).toString().padStart(3, "0");
  } catch {
    return "";
  }
}
