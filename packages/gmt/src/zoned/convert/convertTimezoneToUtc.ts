import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

export function convertTimezoneToUtc(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    return Temporal.ZonedDateTime.from(value).toInstant().toString();
  } catch {
    return "";
  }
}
