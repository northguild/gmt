import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { nowZonedDateTimeISO } from "../../internal/temporalCompat";

/**
 * Return the current ISO day of the week as a number in the system timeZone.
 *
 * - Uses nowZonedDateTimeISO() to get current day in system timezone.
 * - Returns ISO day of week: 1 (Monday) to 7 (Sunday).
 * - Returns null when system timezone is unavailable.
 *
 * @returns current ISO day of week number (1-7) or null on invalid
 *
 * @example getDayOfWeek() // 4
 * @example getDayOfWeek() // null (when system timeZone unavailable)
 */
export function getDayOfWeek(): number | null {
  const timeZone = getSystemTimeZone();
  if (!timeZone) return null;

  try {
    const now = nowZonedDateTimeISO(timeZone);
    return now.dayOfWeek;
  } catch {
    return null;
  }
}
