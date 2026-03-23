import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimezone } from "./getSystemTimezone";

/**
 * Return the current local PlainDateTime as an ISO string using the
 * system timezone.
 *
 * - Uses the system timezone resolved via Intl.DateTimeFormat.
 * - Returns an empty string if the system timezone cannot be determined
 *   or if obtaining the current time fails.
 *
 * @returns ISO 8601 PlainDateTime string or an empty string on error
 */
export function getNow(): string {
  const timeZone = getSystemTimezone();

  if (!timeZone) {
    return "";
  }

  try {
    return Temporal.Now.zonedDateTimeISO(timeZone).toPlainDateTime().toString();
  } catch {
    return "";
  }
}
