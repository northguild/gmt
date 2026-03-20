import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimezone } from "./getSystemTimezone";

export function getToday(): string {
  const timeZone = getSystemTimezone();

  if (!timeZone) {
    return "";
  }

  try {
    return Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate().toString();
  } catch {
    return "";
  }
}
