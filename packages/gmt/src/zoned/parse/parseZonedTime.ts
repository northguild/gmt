import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";
// given an ISO 8601 zoned datetime it returns the time portion
export function parseZonedTime(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime?.toPlainTime().toString();
  } catch {
    return "";
  }
}
