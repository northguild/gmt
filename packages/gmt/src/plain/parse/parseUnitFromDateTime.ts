import { Temporal } from "@js-temporal/polyfill";
import { getWeekNumber } from "../calculate/getWeekNumber";
import { isValidDateTime } from "../validate";

/**
 * Return a specific unit extracted from a PlainDateTime string.
 *
 * - Extracts "year", "month", "day", "week", "dayOfWeek", "hour", "minute", "second", or "millisecond" from a PlainDateTime.
 * - Returns zero-padded string for most units.
 * - Returns "" for invalid input.
 *
 * @param value ISO PlainDateTime string
 * @param unit unit to extract from the datetime
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations
 * @returns string representation of the requested unit or "" on invalid input
 *
 * @example parseUnitFromDateTime("2024-03-15T14:30:45.123", "year") // "2024"
 * @example parseUnitFromDateTime("2024-03-15T14:30:45.123", "week") // "11"
 * @example parseUnitFromDateTime("2024-03-15T14:30:45.123", "hour") // "14"
 * @example parseUnitFromDateTime("2024-03-15T14:30:45.123", "millisecond") // "123"
 * @example parseUnitFromDateTime("invalid", "year") // ""
 * @example parseUnitFromDateTime("2024-01-01T00:00:00", "week", { weekStartsOn: "sunday" }) // "1"
 */
export function parseUnitFromDateTime(
  value: string,
  unit:
    | "year"
    | "month"
    | "day"
    | "week"
    | "dayOfWeek"
    | "hour"
    | "minute"
    | "second"
    | "millisecond",
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): string {
  if (!isValidDateTime(value)) {
    return "";
  }

  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";

  try {
    const dateTime = Temporal.PlainDateTime.from(value);

    switch (unit) {
      case "year":
        return dateTime.year.toString();
      case "month":
        return dateTime.month.toString().padStart(2, "0");
      case "day":
        return dateTime.day.toString().padStart(2, "0");
      case "week":
        return (getWeekNumber(value, weekStartsOn) ?? 0).toString();
      case "dayOfWeek":
        return dateTime.dayOfWeek.toString();
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
  } catch {
    return "";
  }
}
