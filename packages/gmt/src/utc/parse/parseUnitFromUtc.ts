import { Temporal } from "@js-temporal/polyfill";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidUtc } from "../validate";

export type UtcUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "dayOfWeek"
  | "hour"
  | "minute"
  | "second"
  | "millisecond";

/**
 * Extract a unit from a UTC datetime string.
 *
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond".
 * - Uses Temporal.Instant.from to parse, converts to UTC.
 * - Returns "" for invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param unit unit to extract from the datetime
 * @param optionsArg optional: weekStartsOn ("monday" | "sunday") for week calculations
 * @returns string representation of the requested unit or "" on invalid input
 *
 * @example parseUnitFromUtc("2024-03-17T14:30:45Z", "month") // "03"
 * @example parseUnitFromUtc("2024-01-01T00:00:00Z", "week") // "1"
 * @example parseUnitFromUtc("2024-01-01T00:00:00Z", "week", { weekStartsOn: "sunday" }) // "1"
 * @example parseUnitFromUtc("invalid", "month") // ""
 */
export function parseUnitFromUtc(
  value: string,
  unit: UtcUnit,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): string {
  if (!isValidUtc(value)) {
    return "";
  }

  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");

    switch (unit) {
      case "year":
        return dateTime.year.toString();
      case "month":
        return dateTime.month.toString().padStart(2, "0");
      case "week":
        return (
          getWeekNumber(
            `${dateTime.year}-${dateTime.month.toString().padStart(2, "0")}-${dateTime.day.toString().padStart(2, "0")}`,
            weekStartsOn,
          ) ?? 0
        ).toString();
      case "day":
        return dateTime.day.toString().padStart(2, "0");
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
