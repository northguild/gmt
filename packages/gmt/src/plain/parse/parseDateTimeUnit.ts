import { Temporal } from "@js-temporal/polyfill";

import { isValidDateTime } from "../validate";

/**
 * Return a specific unit extracted from a PlainDateTime string.
 *
 * - Valid units: year, month, day, hour, minute, second, millisecond.
 * - Returns an empty string on invalid input.
 *
 * @param value ISO PlainDateTime string
 * @param unit unit to extract from the datetime
 * @example parseDateTimeUnit("2024-03-15T14:30:45.123", "year") // "2024"
 * @example parseDateTimeUnit("2024-03-15T14:30:45.123", "hour") // "14"
 * @example parseDateTimeUnit("2024-03-15T14:30:45.123", "millisecond") // "123"
 * @example parseDateTimeUnit("invalid", "year") // ""
 * @returns string representation of the requested unit or "" on invalid input
 */
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
