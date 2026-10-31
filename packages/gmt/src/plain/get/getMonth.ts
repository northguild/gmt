import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { nowZonedDateTimeISO } from "../../internal/temporalCompat";

/**
 * Return the current month using the system timeZone.
 *
 * - Uses nowZonedDateTimeISO() to get current month in system timezone.
 * - Returns zero-padded string (e.g., "02").
 * - Returns "" when system timezone is unavailable.
 *
 * @returns current month string (zero-padded) or "" on invalid
 *
 * @example getMonth() // "02"
 * @example getMonth() // "" (when system timeZone unavailable)
 */
export function getMonth(): string {
  const timeZone = getSystemTimeZone();
  if (!timeZone) return "";

  try {
    return nowZonedDateTimeISO(timeZone).month.toString().padStart(2, "0");
  } catch {
    return "";
  }
}
