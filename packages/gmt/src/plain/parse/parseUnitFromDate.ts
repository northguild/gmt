import { Temporal } from "@js-temporal/polyfill";
import { getWeekNumber } from "../calculate/getWeekNumber";
import { isValidDate } from "../validate";

/**
 * Return a specific date unit extracted from a PlainDate string.
 *
 * - Extracts "year", "month", "day", "week", or "dayOfWeek" from a PlainDate.
 * - Returns zero-padded string for month and day.
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainDate string
 * @param unit unit to extract from the date
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations
 * @returns string representation of the requested unit or "" on invalid input
 *
 * @example parseUnitFromDate("2024-03-15", "year") // "2024"
 * @example parseUnitFromDate("2024-03-15", "month") // "03"
 * @example parseUnitFromDate("2024-03-15", "day") // "15"
 * @example parseUnitFromDate("2024-03-15", "week") // "11"
 * @example parseUnitFromDate("2024-03-15", "dayOfWeek") // "5"
 * @example parseUnitFromDate("invalid", "year") // ""
 * @example parseUnitFromDate("2024-01-01", "week", { weekStartsOn: "sunday" }) // "1"
 */
export function parseUnitFromDate(
  value: string,
  unit: "year" | "month" | "day" | "week" | "dayOfWeek",
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): string {
  if (!isValidDate(value)) {
    return "";
  }

  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";

  try {
    const date = Temporal.PlainDate.from(value);

    switch (unit) {
      case "year":
        return date.year.toString();
      case "month":
        return date.month.toString().padStart(2, "0");
      case "day":
        return date.day.toString().padStart(2, "0");
      case "week":
        return (getWeekNumber(value, weekStartsOn) ?? 0).toString();
      case "dayOfWeek":
        return date.dayOfWeek.toString();
      default:
        return "";
    }
  } catch {
    return "";
  }
}
