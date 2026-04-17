import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "./getSystemTimeZone";

/**
 * Return the current PlainDate as an ISO string in the system timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get current date in system timezone.
 * - Returns "" when system timezone is unavailable.
 *
 * @returns ISO 8601 PlainDate string or "" on error
 *
 * @example getToday() // "2024-03-15" (current date)
 */
export function getToday(): string {
  const timeZone = getSystemTimeZone();

  if (!timeZone) {
    return "";
  }

  try {
    return Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate().toString();
  } catch {
    return "";
  }
}
