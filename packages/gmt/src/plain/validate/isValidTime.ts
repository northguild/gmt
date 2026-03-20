import { Temporal } from "@js-temporal/polyfill";
import { plainTime } from "../../regex";

export function isValidTime(value: string): boolean {
  if (!plainTime.test(value)) {
    return false;
  }

  try {
    Temporal.PlainTime.from(value);
    return true;
  } catch {
    return false;
  }
}
