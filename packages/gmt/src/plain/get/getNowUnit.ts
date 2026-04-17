import { Temporal } from "@js-temporal/polyfill";
import type { DateTimeUnit } from "../../types";
import { parseWeekFromDate } from "../parse";
import { isValidDateTimeUnit } from "../validate";
import { getSystemTimeZone } from "./getSystemTimeZone";

type NowUnit = DateTimeUnit | "dayOfWeek";

function isValidPlainNowUnit(unit: string): unit is NowUnit {
  return isValidDateTimeUnit(unit) || ["dayOfWeek"].includes(unit);
}

/**
 * Return the requested current unit value using the system timeZone.
 *
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Uses Temporal.Now.zonedDateTimeISO to get current time in system timezone.
 * - Returns "" when unit is invalid or system timezone is unavailable.
 *
 * @param unit unit to extract from current local time
 * @returns string representation of the requested unit or "" on invalid
 *
 * @example getNowUnit("year") // "2024"
 * @example getNowUnit("month") // "03"
 * @example getNowUnit("week") // "11"
 * @example getNowUnit("day") // "15"
 * @example getNowUnit("dayOfWeek") // "5"
 * @example getNowUnit("hour") // "14"
 * @example getNowUnit("minute") // "30"
 * @example getNowUnit("second") // "45"
 * @example getNowUnit("millisecond") // "000"
 * @example getNowUnit("microsecond") // "000"
 * @example getNowUnit("nanosecond") // "000"
 * @example getNowUnit("invalid") // ""
 */
export function getNowUnit(unit: NowUnit): string {
  if (!isValidPlainNowUnit(String(unit ?? ""))) return "";

  const timeZone = getSystemTimeZone();
  if (!timeZone) return "";

  let now: Temporal.ZonedDateTime;
  try {
    now = Temporal.Now.zonedDateTimeISO(timeZone);
  } catch {
    return "";
  }

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
}
