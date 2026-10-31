import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { nowPlainDateTimeISO } from "../../internal/temporalCompat";

/**
 * Return the current microsecond using the system timeZone.
 *
 * - Uses nowPlainDateTimeISO() to get current microsecond in system timezone.
 * - Returns zero-padded string to 3 digits (e.g., "456").
 * - Returns "" when system timezone is unavailable.
 *
 * @returns current microsecond string (zero-padded to 3 digits) or "" on invalid
 *
 * @example getMicrosecond() // "000"
 * @example getMicrosecond() // "" (when system timeZone unavailable)
 */
export function getMicrosecond(): string {
  const timeZone = getSystemTimeZone();
  if (!timeZone) {
    return "";
  }

  try {
    const now = nowPlainDateTimeISO(timeZone);
    return (now.microsecond ?? 0).toString().padStart(3, "0");
  } catch {
    return "";
  }
}
