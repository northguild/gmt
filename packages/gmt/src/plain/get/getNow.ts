import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "./getSystemTimeZone";

/**
 * Return the current local PlainDateTime as an ISO string using the
 * system timeZone.
 *
 * - Uses the system timeZone resolved via Intl.DateTimeFormat.
 * - Returns an empty string if the system timeZone cannot be determined
 *   or if obtaining the current time fails.
 *
 * @example getNow() // "2024-03-15T14:30:45" (current time)
 * @returns ISO 8601 PlainDateTime string or an empty string on error
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
