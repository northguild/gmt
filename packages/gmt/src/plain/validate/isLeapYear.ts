import { Temporal } from "@js-temporal/polyfill";

export function isLeapYear(value: string): boolean {
  try {
    const date = Temporal.PlainDate.from(value);
    return date.inLeapYear;
  } catch {
    return false;
  }
}
