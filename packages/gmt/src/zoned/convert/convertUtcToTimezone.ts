import { Temporal } from "@js-temporal/polyfill";
import { isUtcDateTime } from "../../plain/validate/isUtcDateTime";
import { isValidTimezone } from "../validate";

export function convertUtcToTimezone(value: string, timeZone: string): string {
  if (!isUtcDateTime(value) || !isValidTimezone(timeZone)) {
    return "";
  }

  try {
    return Temporal.Instant.from(value).toZonedDateTimeISO(timeZone).toString();
  } catch {
    return "";
  }
}
