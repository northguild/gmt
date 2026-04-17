import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeUnit } from "../../plain/validate";
import type { DateTimeUnit } from "../../types";

type UtcNowUnit = DateTimeUnit | "dayOfWeek";

function isValidUtcNowUnit(unit: string): unit is UtcNowUnit {
  return isValidDateTimeUnit(unit) || ["dayOfWeek"].includes(unit);
}

/**
 * Return the requested unit value from the current UTC instant.
 *
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Uses Temporal.Now.instant() converted to UTC.
 * - Returns "" on invalid unit or failure.
 *
 * @param unit unit to extract from current utc instant
 * @returns string representation of the requested unit or "" on invalid
 *
 * @example getUtcNowUnit("year") // "2024"
 * @example getUtcNowUnit("month") // "02"
 * @example getUtcNowUnit("invalid") // ""
 */
export function getUtcNowUnit(unit: UtcNowUnit): string {
  if (!isValidUtcNowUnit(String(unit ?? ""))) return "";

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
