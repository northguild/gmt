import { Temporal } from "@js-temporal/polyfill";
import { isValidDate } from "../../plain/validate";
import { isValidTimezone } from "../validate";

export function getZonedDate(value: string, timeZone: string): string {
  if (!isValidDate(value) || !isValidTimezone(timeZone)) {
    return "";
  }

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(`${value}[${timeZone}]`);
    return zonedDateTime.toPlainDate().toString();
  } catch {
    return "";
  }
}
