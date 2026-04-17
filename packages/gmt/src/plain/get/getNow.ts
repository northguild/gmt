import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "./getSystemTimeZone";

/**
 * Return the current local PlainDateTime as an ISO string using the system timeZone.
 *
 * - Uses Temporal.Now.zonedDateTimeISO to get current time in system timezone.
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
    return Temporal.Now.zonedDateTimeISO(timeZone).toPlainDateTime().toString();
  } catch {
    return "";
  }
}
