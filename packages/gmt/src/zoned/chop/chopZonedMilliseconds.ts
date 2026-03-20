import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate/isValidZonedDateTime";

export function chopZonedMilliseconds(value: string): string {
  if (!isValidZonedDateTime(value)) return "";
  try {
    return Temporal.ZonedDateTime.from(value).toString({
      smallestUnit: "second",
    });
  } catch {
    return "";
  }
}
