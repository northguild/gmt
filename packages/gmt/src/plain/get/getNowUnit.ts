import { Temporal } from "@js-temporal/polyfill";
import { weekOfYear } from "../calculate/weekOfYear";
import { getSystemTimeZone } from "./getSystemTimeZone";

export type PlainNowUnit =
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

function isValidPlainNowUnit(unit: string): unit is PlainNowUnit {
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
 * Return the requested current unit value using the system timeZone.
 *
 * - Uses the runtime system timeZone via `getSystemTimeZone()`.
 * - Returns an empty string on invalid unit or when the system timeZone
 *   cannot be determined.
 *
 * @param unit unit to extract from current local time
 * @returns string representation of the requested unit or "" when invalid
 */
export function getNowUnit(unit: PlainNowUnit): string {
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
