import { Temporal } from "@js-temporal/polyfill";
import { zonedNowUnitValue } from "../../internal/zonedNowUnitValue";
import type { NowUnit } from "../../types";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { parseWeekFromDate } from "../parse";
import { isValidDateTimeUnit } from "../validate";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";

export type { NowUnit };

function isValidPlainNowUnit(unit: string): unit is NowUnit {
  return isValidDateTimeUnit(unit) || ["dayOfWeek"].includes(unit);
}

/**
 * Return the requested current unit value using the system timeZone.
 *
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Uses Temporal.Now.zonedDateTimeISO to get current time in system timezone.
 * - `unit` accepts the singular or plural name of a Temporal unit (`"hour"` or `"hours"`), as Temporal
 *   does; `"dayOfWeek"` has no plural.
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
 * @example getNowUnit("hours") // "14", if the local time is 14:xx (plural unit name)
 * @example getNowUnit("invalid") // ""
 */
export function getNowUnit(unit: NowUnit): string {
  const resolvedUnit = resolveDateTimeUnit(unit);
  if (!isValidPlainNowUnit(String(resolvedUnit ?? ""))) return "";

  const timeZone = getSystemTimeZone();
  if (!timeZone) return "";

  let now: Temporal.ZonedDateTime;
  try {
    now = Temporal.Now.zonedDateTimeISO(timeZone);
  } catch {
    return "";
  }

  return zonedNowUnitValue(now, resolvedUnit, (zdt) => {
    const w = parseWeekFromDate(zdt.toPlainDate().toString());
    return w === null ? "" : w.toString();
  });
}
