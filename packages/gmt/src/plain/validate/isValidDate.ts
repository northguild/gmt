import { Temporal } from "@js-temporal/polyfill";
import { plainDate } from "../../regex";

export function isValidDate(value: string): boolean {
  if (!plainDate.test(value)) {
    return false;
  }

  try {
    Temporal.PlainDate.from(value);
    return true;
  } catch {
    return false;
  }
}
