import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

export function parseDateTimeUnit(
  value: string,
  unit: "year" | "month" | "day" | "hour" | "minute" | "second" | "millisecond",
): string {
  if (!isValidDateTime(value)) {
    return "";
  }

  const dateTime = Temporal.PlainDateTime.from(value);

  switch (unit) {
    case "year":
      return dateTime.year.toString();
    case "month":
      return dateTime.month.toString().padStart(2, "0");
    case "day":
      return dateTime.day.toString().padStart(2, "0");
    case "hour":
      return dateTime.hour.toString().padStart(2, "0");
    case "minute":
      return dateTime.minute.toString().padStart(2, "0");
    case "second":
      return dateTime.second.toString().padStart(2, "0");
    case "millisecond":
      return dateTime.millisecond.toString().padStart(3, "0");
    default:
      return "";
  }
}
