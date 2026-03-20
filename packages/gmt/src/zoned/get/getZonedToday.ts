import { Temporal } from "@js-temporal/polyfill";
import { isValidTimezone } from "../validate";

// returns today's date for specified timezone

export function getZonedToday(ianaTimezone: string): string {
  if (!isValidTimezone(ianaTimezone)) {
    return "";
  }

  try {
    const today = Temporal.Now.zonedDateTimeISO(ianaTimezone).toPlainDate();
    return today.toString();
  } catch {
    return "";
  }
}
