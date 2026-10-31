import { Temporal } from "../../internal/temporal";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { nowPlainDateTimeISO } from "../../internal/temporalCompat";

/**
 * Get the ISO week number of the current date.
 *
 * - Uses nowPlainDateTimeISO() to get current date in system timezone.
 * - Uses Temporal.PlainDate.weekOfYear for ISO week number.
 * - Returns null when system timezone is unavailable.
 *
 * @returns The ISO week number (1-53), or null on invalid
 *
 * @example getWeekOfYear() // 15
 * @example getWeekOfYear() // null (when system timeZone unavailable)
 */
export function getWeekOfYear(): number | null {
  const timeZone = getSystemTimeZone();
  if (!timeZone) {
    return null;
  }

  try {
    const now = nowPlainDateTimeISO(timeZone);
    const date = Temporal.PlainDate.from({
      year: now.year,
      month: now.month,
      day: now.day,
    });

    return date.weekOfYear ?? null;
  } catch {
    return null;
  }
}
