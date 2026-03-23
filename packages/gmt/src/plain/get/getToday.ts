import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimezone } from "./getSystemTimezone";

/**
 * Return the current PlainDate as an ISO string in the system timezone.
 *
 * - Uses the system timezone resolved via Intl.
 * - Returns an empty string on failure.
 *
 * @returns ISO 8601 PlainDate string or an empty string on error
 */
export function getToday(): string {
  const timeZone = getSystemTimezone();

  if (!timeZone) {
    return "";
  }

  try {
    return Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate().toString();
  } catch {
    return "";
  }
}
