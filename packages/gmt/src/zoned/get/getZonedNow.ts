import { Temporal } from "@js-temporal/polyfill";
import { isValidTimezone } from "../validate";

export function getZonedNow(ianaTimezone: string): string {
  if (!isValidTimezone(ianaTimezone)) {
    return "";
  }

  try {
    const now = Temporal.Now.zonedDateTimeISO(ianaTimezone);
    return now.toString();
  } catch {
    return "";
  }
}
