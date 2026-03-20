import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

export function parseDateUnit(
  value: string,
  unit: "year" | "month" | "day",
): string {
  if (!isValidDate(value)) {
    return "";
  }

  const date = Temporal.PlainDate.from(value);

  switch (unit) {
    case "year":
      return date.year.toString();
    case "month":
      return date.month.toString().padStart(2, "0");
    case "day":
      return date.day.toString().padStart(2, "0");
    default:
      return "";
  }
}
