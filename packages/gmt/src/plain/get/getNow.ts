import { Temporal } from "@js-temporal/polyfill";
import { getSystemTimezone } from "./getSystemTimezone";

export function getNow(): string {
  const timeZone = getSystemTimezone();

  if (!timeZone) {
    return "";
  }

  try {
    return Temporal.Now.zonedDateTimeISO(timeZone).toPlainDateTime().toString();
  } catch {
    return "";
  }
}
