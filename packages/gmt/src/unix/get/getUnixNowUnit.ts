import { Temporal } from "@js-temporal/polyfill";
import {
  isoWeekOfYear,
  zonedNowUnitValue,
} from "../../internal/zonedNowUnitValue";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";
import { isValidDateTimeUnit } from "../../plain/validate";
import type { UnixNowUnit } from "../../types";

export type { UnixNowUnit };

function isValidUnixNowUnit(unit: string): unit is UnixNowUnit {
  return isValidDateTimeUnit(unit) || unit === "dayOfWeek";
}

/**
 * Return the requested unit value from the current Unix timestamp in UTC.
 *
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond". Temporal units may also be plural ("hours").
 * - `microsecond` and `nanosecond` are Temporal's 0–999 fields, zero-padded to 3 digits.
 * - Uses Temporal.Now.instant() converted to UTC zoned date time.
 * - Returns "" on invalid unit or failure.
 *
 * @param unit unit to extract from current unix timestamp
 * @returns string representation of the requested unit or "" on invalid
 *
 * @example getUnixNowUnit("year") // "2024"
 * @example getUnixNowUnit("month") // "02"
 * @example getUnixNowUnit("months") // "02" (plural unit)
 * @example getUnixNowUnit("invalid") // ""
 */
export function getUnixNowUnit(
  unit: UnixNowUnit | Temporal.PluralUnit<Temporal.DateTimeUnit>,
): string {
  const resolved = typeof unit === "string" ? resolveDateTimeUnit(unit) : "";

  if (!isValidUnixNowUnit(resolved)) return "";

  try {
    const now = Temporal.Now.instant().toZonedDateTimeISO("UTC");
    return zonedNowUnitValue(now, resolved, isoWeekOfYear);
  } catch {
    return "";
  }
}
