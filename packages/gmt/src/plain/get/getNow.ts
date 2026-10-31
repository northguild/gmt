import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { nowZonedDateTimeISO } from "../../internal/temporalCompat";

/**
 * Return the current local PlainDateTime as an ISO string using the system timeZone.
 *
 * - Uses nowZonedDateTimeISO() to get current time in system timezone.
 * - Returns "" when system timezone is unavailable.
 *
 * @returns ISO 8601 PlainDateTime string or "" on error
 *
 * @example getNow() // "2024-03-15T14:30:45" (current time)
 */
export function getNow(): string {
  const timeZone = getSystemTimeZone();

  if (!timeZone) {
    return "";
  }

  try {
    return nowZonedDateTimeISO(timeZone).toPlainDateTime().toString();
  } catch {
    return "";
  }
}
