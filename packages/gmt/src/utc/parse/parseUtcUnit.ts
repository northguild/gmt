import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

export type UtcUnit =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "millisecond";

/**
 * Extract a unit from a UTC datetime string.
 *
 * - `value` must be a valid UTC ISO datetime string (ending in Z).
 * - Valid units: year, month, day, hour, minute, second, millisecond.
 * - Returns empty string on invalid input.
 *
 * @param value ISO UTC datetime string (e.g., "2024-03-17T14:30:45Z")
 * @param unit unit to extract from the datetime
 * @example parseUtcUnit("2024-03-17T14:30:45Z", "month") // returns "03"
 * @returns string representation of the requested unit or "" on invalid input
 */
export function parseUtcUnit(value: string, unit: UtcUnit): string {
  if (!isValidUtc(value)) {
    return "";
  }

  try {
    const instant = Temporal.Instant.from(value);
    const dateTime = instant.toZonedDateTimeISO("UTC");

    switch (unit) {
      case "year":
        return dateTime.year.toString();
      case "month":
        return dateTime.month.toString().padStart(2, "0");
      case "day":
        return dateTime.day.toString().padStart(2, "0");
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
