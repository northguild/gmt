import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain/validate";
import type { DateTimeUnit } from "../../types";

type UnixNowUnit = DateTimeUnit | "dayOfWeek";

function isValidUnixNowUnit(unit: string): unit is UnixNowUnit {
  return isValidDateTimeUnit(unit) || ["dayOfWeek"].includes(unit);
}

/**
 * Return the requested unit value from the current Unix timestamp in UTC.
 *
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns "" on invalid unit or failure.
 *
 * @param unit unit to extract from current unix timestamp
 * @returns string representation of the requested unit or "" on invalid
 *
 * @example getUnixNowUnit("year") // "2024"
 * @example getUnixNowUnit("month") // "02"
 * @example getUnixNowUnit("invalid") // ""
 */
export function getUnixNowUnit(unit: UnixNowUnit): string {
  if (!isValidUnixNowUnit(String(unit ?? ""))) return "";

  try {
    const now = Temporal.Now.instant().toZonedDateTimeISO("UTC");
    const plainDateTime = now.toPlainDateTime();
    const plainDate = Temporal.PlainDate.from({
      year: plainDateTime.year,
      month: plainDateTime.month,
      day: plainDateTime.day,
    });

    switch (unit) {
      case "year":
        return plainDateTime.year.toString();
      case "month":
        return plainDateTime.month.toString().padStart(2, "0");
      case "week":
        return (plainDate.weekOfYear ?? 0).toString();
      case "day":
        return plainDateTime.day.toString().padStart(2, "0");
      case "dayOfWeek":
        return now.dayOfWeek.toString();
      case "hour":
        return plainDateTime.hour.toString().padStart(2, "0");
      case "minute":
        return plainDateTime.minute.toString().padStart(2, "0");
      case "second":
        return plainDateTime.second.toString().padStart(2, "0");
      case "millisecond":
        return plainDateTime.millisecond.toString().padStart(3, "0");
      case "microsecond":
        return (plainDateTime.microsecond ?? 0).toString().padStart(3, "0");
      case "nanosecond":
        return (plainDateTime.nanosecond ?? 0).toString().padStart(3, "0");
      default:
        return "";
    }
  } catch {
    return "";
  }
}
