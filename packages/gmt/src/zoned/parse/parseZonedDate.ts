import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

// given an ISO 8601 zoned datetime it returns the date portion
export function parseZonedDate(value: string): string {
  if (!isValidZonedDateTime(value)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime?.toPlainDate().toString();
  } catch {
    return "";
  }
}
