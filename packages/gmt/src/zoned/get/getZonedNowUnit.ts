import { Temporal } from "@js-temporal/polyfill";
import { parseWeekFromDate } from "../../plain/parse";
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
 * - Uses Temporal.Now.zonedDateTimeISO to get the current time.
 * - Uses weekOfYear helper for week calculations.
 * - Validation is performed on timezone and unit.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @param unit unit to extract from current zoned time
 * @returns string representation of the requested unit or "" on invalid input
 *
 * @example getZonedNowUnit("America/New_York", "hour") // "07"
 * @example getZonedNowUnit("invalid", "hour") // ""
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

  try {
    const now = Temporal.Now.zonedDateTimeISO(ianaTimezone);

    switch (unit) {
      case "year":
        return now.year.toString();
      case "month":
        return now.month.toString().padStart(2, "0");
      case "week": {
        const w = parseWeekFromDate(now.toPlainDate().toString());
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
  } catch {
    return "";
  }
}
