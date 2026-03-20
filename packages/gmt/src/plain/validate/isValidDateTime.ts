import { Temporal } from "@js-temporal/polyfill";
import { plainDateTime } from "../../regex";
import { isLeapSecond } from "./isLeapSecond";

export function isValidDateTime(value: string): boolean {
  if (isLeapSecond(value)) {
    return false;
  }

  if (!plainDateTime.test(value)) {
    return false;
  }

  try {
    Temporal.PlainDateTime.from(value);
    return true;
  } catch {
    return false;
  }
}
