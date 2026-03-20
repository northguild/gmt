import { Temporal } from "@js-temporal/polyfill";

import { isValidTime } from "../validate";

export function isAfterTime(value1: string, value2: string): boolean {
  if (!isValidTime(value1) || !isValidTime(value2)) {
    return false;
  }

  try {
    return (
      Temporal.PlainTime.compare(
        Temporal.PlainTime.from(value1),
        Temporal.PlainTime.from(value2),
      ) === 1
    );
  } catch {
    return false;
  }
}
