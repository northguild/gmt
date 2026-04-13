import { Temporal } from "@js-temporal/polyfill";
import { weekOfYear } from "../../plain/calculate/weekOfYear";
import { isValidTimeZone } from "../validate";

export type ZonedNowUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "dayOfWeek"
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "microsecond"
  | "nanosecond";

function isValidZonedNowUnit(unit: string): unit is ZonedNowUnit {
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
    "microsecond",
    "nanosecond",
  ].includes(unit);
}

/**
 * Return the requested current unit value for the specified IANA timeZone.
 *
 * - Returns empty string for invalid timeZone or unit.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @param unit unit to extract from current zoned time
 * @returns string representation of the requested unit or "" when invalid
 */
export function getZonedNowUnit(
  ianaTimezone: string,
  unit: ZonedNowUnit,
): string {
  if (
    !isValidTimeZone(ianaTimezone) ||
    !isValidZonedNowUnit(String(unit ?? ""))
  ) {
    return "";
  }

  let now: Temporal.ZonedDateTime;
  try {
    now = Temporal.Now.zonedDateTimeISO(ianaTimezone);
  } catch {
    return "";
  }

  switch (unit) {
    case "year":
      return now.year.toString();
    case "month":
      return now.month.toString().padStart(2, "0");
    case "week": {
      const w = weekOfYear(now.toPlainDate().toString());
      return w === null ? "" : w.toString();
    }
    case "day":
      return now.day.toString().padStart(2, "0");
    case "dayOfWeek":
      return now.dayOfWeek.toString();
    case "hour":
      return now.hour.toString().padStart(2, "0");
    case "minute":
      return now.minute.toString().padStart(2, "0");
    case "second":
      return now.second.toString().padStart(2, "0");
    case "millisecond":
      return now.millisecond.toString().padStart(3, "0");
    case "microsecond":
      return (now.microsecond ?? 0).toString().padStart(3, "0");
    case "nanosecond":
      return (now.nanosecond ?? 0).toString().padStart(3, "0");
    default:
      return "";
  }
}
