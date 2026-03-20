import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../../plain/validate";
import { isValidTimezone } from "../validate";

export function getZonedDateTime(value: string, timeZone: string): string {
  if (!isValidDateTime(value) || !isValidTimezone(timeZone)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(`${value}[${timeZone}]`);
    return zonedDateTime.toString();
  } catch {
    return "";
  }
}
