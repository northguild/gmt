import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimeZone } from "./getSystemTimeZone";

/**
 * Return the current PlainDate as an ISO string in the system timeZone.
 *
 * - Uses the system timeZone resolved via Intl.
 * - Returns an empty string on failure.
 *
 * @example getToday() // "2024-03-15" (current date)
 * @returns ISO 8601 PlainDate string or an empty string on error
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
