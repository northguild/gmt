import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

export function isAfterDateTime(value1: string, value2: string): boolean {
  if (!isValidDateTime(value1) || !isValidDateTime(value2)) {
    return false;
  }

  try {
    return (
      Temporal.PlainDateTime.compare(
        Temporal.PlainDateTime.from(value1),
        Temporal.PlainDateTime.from(value2),
      ) === 1
    );
  } catch {
    return false;
  }
}
