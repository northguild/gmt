import { Temporal } from "@js-temporal/polyfill";
import { isValidZonedDateTime } from "../validate";

export type ZonedParseUnit =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "nanosecond"
  | "timezone";

function isValidZonedUnit(unit: string): unit is ZonedParseUnit {
  return [
    "year",
    "month",
    "day",
    "hour",
    "minute",
    "second",
    "millisecond",
    "nanosecond",
    "timezone",
  ].includes(unit);
}

/**
 * Return the requested unit value from an ISO 8601 zoned datetime string.
 *
 * - Supported units include year, month, day, hour, minute, second,
 *   millisecond, nanosecond, and timezone.
 * - Returns empty string "" for invalid zoned datetime or unit.
 *
 * @param value zoned ISO 8601 datetime string
 * @param unit unit to extract
 * @returns string representation of the requested unit or empty string when invalid
 */
export function parseZonedUnit(value: string, unit: ZonedParseUnit): string {
  if (!isValidZonedDateTime(value) || !isValidZonedUnit(unit)) {
    return "";
  }

  let zonedDateTime: Temporal.ZonedDateTime;
  try {
    zonedDateTime = Temporal.ZonedDateTime.from(value);
  } catch {
    return "";
  }

  switch (unit) {
    case "year":
      return zonedDateTime.year.toString();
    case "month":
      return zonedDateTime.month.toString().padStart(2, "0");
    case "day":
      return zonedDateTime.day.toString().padStart(2, "0");
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
    case "timezone":
      return zonedDateTime.timeZoneId;
    default:
      return "";
  }
}
