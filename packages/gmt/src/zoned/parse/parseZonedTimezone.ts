import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";
// given an ISO 8601 zoned datetime it returns the timezone portion
export function parseZonedTimezone(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  return Temporal.ZonedDateTime.from(value).timeZoneId ?? "";
}
