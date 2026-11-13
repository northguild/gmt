import { todayDate } from "../../internal/todayDate";

/**
 * Return the current PlainDate as an ISO string in the system timeZone.
 *
 * - Uses nowZonedDateTimeISO() to get current date in system timezone.
 * - Returns "" when system timezone is unavailable.
 *
 * @returns ISO 8601 PlainDate string or "" on error
 *
 * @example getToday() // "2024-03-15" (current date)
 */
export function getToday(): string {
  return todayDate()?.toString() ?? "";
}
