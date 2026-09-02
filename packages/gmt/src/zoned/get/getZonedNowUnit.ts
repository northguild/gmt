import { Temporal } from "@js-temporal/polyfill";
import { parseWeekFromDate } from "../../plain/parse";
import { isValidTimeZone } from "../validate";

/**
 * Units extractable from the current time in a specific IANA timeZone, as
 * consumed by `getZonedNowUnit`.
 *
 * @remarks Members:
 *
 * | Member | Description |
 * | --- | --- |
 * | `year` | Full calendar year (e.g. `2024`), no padding. |
 * | `month` | 1–12, zero-padded to 2 digits (e.g. `02`). |
 * | `week` | Week-of-year from `parseWeekFromDate`, 1–53. |
 * | `day` | Day of month 1–31, zero-padded (e.g. `15`). |
 * | `dayOfWeek` | 1 (Mon)–7 (Sun). |
 * | `hour` | 0–23, zero-padded. |
 * | `minute` | 0–59, zero-padded. |
 * | `second` | 0–59, zero-padded. |
 * | `millisecond` | 0–999, zero-padded to 3. |
 * | `microsecond` | Sub-millisecond microseconds (0–999999). |
 * | `nanosecond` | Sub-millisecond nanoseconds (0–999999999). |
 *
 * @example
 * import { ZonedNowUnit } from "@northguild/gmt/zoned";
 * const u: ZonedNowUnit = "hour";
 */
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
