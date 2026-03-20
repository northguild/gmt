import { Temporal } from "@js-temporal/polyfill";

import { isValidTime } from "../validate";

export function parseTimeUnit(
  value: string,
  unit: "hour" | "minute" | "second" | "millisecond",
): string {
  if (!isValidTime(value)) {
    return "";
  }

  const time = Temporal.PlainTime.from(value);

  switch (unit) {
    case "hour":
      return time.hour.toString().padStart(2, "0");
    case "minute":
      return time.minute.toString().padStart(2, "0");
    case "second":
      return time.second.toString().padStart(2, "0");
    case "millisecond":
      return time.millisecond.toString().padStart(3, "0");
    default:
      return "";
  }
}
