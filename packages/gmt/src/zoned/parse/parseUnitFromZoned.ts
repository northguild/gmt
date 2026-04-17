import { Temporal } from "@js-temporal/polyfill";
import { getWeekNumber } from "../../plain/calculate/getWeekNumber";
import { isValidZonedDateTime } from "../validate";

export type ZonedParseUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "dayOfWeek"
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "nanosecond"
  | "timeZone";

function isValidZonedUnit(unit: string): unit is ZonedParseUnit {
  return [
    "year",
    "month",
    "week",
    "day",
    "dayOfWeek",
    "hour",
    "minute",
    "second",
    "millisecond",
    "nanosecond",
    "timeZone",
  ].includes(unit);
}

/**
 * Return the requested unit value from an ISO 8601 zoned datetime string.
 *
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond", "nanosecond", "timeZone".
 * - Uses Temporal.ZonedDateTime.from to parse.
 * - Returns "" for invalid input.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit unit to extract
 * @param options optional settings (e.g. weekStartsOn for week calculations)
 * @returns string representation of the requested unit or "" when invalid
 *
 * @example parseUnitFromZoned("2024-02-29T12:34:56.789+00:00[UTC]", "year") // "2024"
 * @example parseUnitFromZoned("invalid", "year") // ""
 */
export function parseUnitFromZoned(
  value: string,
  unit: ZonedParseUnit,
  optionsArg?: { weekStartsOn?: "monday" | "sunday" },
): string {
  if (!isValidZonedDateTime(value) || !isValidZonedUnit(unit)) {
    return "";
  }
  const weekStartsOn = optionsArg?.weekStartsOn ?? "monday";

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(value);

    switch (unit) {
      case "year":
        return zonedDateTime.year.toString();
      case "month":
        return zonedDateTime.month.toString().padStart(2, "0");
      case "week":
        return (
          getWeekNumber(
            `${zonedDateTime.year}-${zonedDateTime.month.toString().padStart(2, "0")}-${zonedDateTime.day.toString().padStart(2, "0")}`,
            weekStartsOn,
          ) ?? 0
        ).toString();
      case "day":
        return zonedDateTime.day.toString().padStart(2, "0");
      case "dayOfWeek":
        return zonedDateTime.dayOfWeek.toString();
      case "hour":
        return zonedDateTime.hour.toString().padStart(2, "0");
      case "minute":
        return zonedDateTime.minute.toString().padStart(2, "0");
      case "second":
        return zonedDateTime.second.toString().padStart(2, "0");
      case "millisecond":
        return zonedDateTime.millisecond.toString().padStart(3, "0");
      case "nanosecond":
        return zonedDateTime.nanosecond.toString().padStart(3, "0");
      case "timeZone":
        return zonedDateTime.timeZoneId;
      default:
        return "";
    }
  } catch {
    return "";
  }
}
