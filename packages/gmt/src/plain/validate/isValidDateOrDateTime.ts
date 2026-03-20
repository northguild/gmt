import { Temporal } from "@js-temporal/polyfill";
import { plainDate, plainDateTime } from "../../regex";

export function isValidDateOrDateTime(value: string): boolean {
  if (plainDate.test(value)) {
    try {
      Temporal.PlainDate.from(value);
      return true;
    } catch {
      return false;
    }
  }

  if (plainDateTime.test(value)) {
    try {
      Temporal.PlainDateTime.from(value);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
