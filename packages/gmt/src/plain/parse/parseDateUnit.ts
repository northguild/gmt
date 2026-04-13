import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Return a specific date unit extracted from a PlainDate string.
 *
 * - Valid units: year, month, day.
 * - Returns an empty string on invalid input.
 *
 * @param value ISO PlainDate string
 * @param unit unit to extract from the date
 * @example parseDateUnit("2024-03-15", "year") // "2024"
 * @example parseDateUnit("2024-03-15", "month") // "03"
 * @example parseDateUnit("2024-03-15", "day") // "15"
 * @example parseDateUnit("invalid", "year") // ""
 * @returns string representation of the requested unit or "" on invalid input
 */
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
