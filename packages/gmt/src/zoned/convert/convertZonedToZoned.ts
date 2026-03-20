import { Temporal } from "@js-temporal/polyfill";
import { isValidTimezone, isValidZonedDateTime } from "../validate";

export function convertZonedToZoned(value: string, timeZone: string): string {
  if (!isValidZonedDateTime(value) || !isValidTimezone(timeZone)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.withTimeZone(timeZone).toString();
  } catch {
    return "";
  }
}
