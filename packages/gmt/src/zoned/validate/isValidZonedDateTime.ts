import { Temporal } from "@js-temporal/polyfill";
import { isLeapSecond } from "../../plain/validate/isLeapSecond";

export function isValidZonedDateTime(value: string): boolean {
  if (isLeapSecond(value)) {
    return false;
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);
    return zonedDateTime.timeZoneId.length > 0;
  } catch {
    return false;
  }
}
