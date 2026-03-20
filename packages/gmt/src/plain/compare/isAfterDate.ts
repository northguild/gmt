import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

export function isAfterDate(value1: string, value2: string): boolean {
  if (!isValidDate(value1) || !isValidDate(value2)) {
    return false;
  }

  try {
    return (
      Temporal.PlainDate.compare(
        Temporal.PlainDate.from(value1),
        Temporal.PlainDate.from(value2),
      ) === 1
    );
  } catch {
    return false;
  }
}
