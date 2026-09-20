import { Temporal } from "@js-temporal/polyfill";
import {
  isoWeekOfYear,
  zonedNowUnitValue,
} from "../../internal/zonedNowUnitValue";
import { isValidDateTimeUnit } from "../../plain/validate";
import type { UtcNowUnit } from "../../types";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";

export type { UtcNowUnit };

function isValidUtcNowUnit(unit: string): unit is UtcNowUnit {
  return isValidDateTimeUnit(unit) || ["dayOfWeek"].includes(unit);
}

/**
 * Return the requested unit value from the current UTC instant.
 *
 * - Valid units: "year", "month", "week", "day", "dayOfWeek", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond".
 * - Uses Temporal.Now.instant() converted to UTC.
 * - `unit` accepts the singular or plural name of a Temporal unit (`"hour"` or `"hours"`), as Temporal
 *   does; `"dayOfWeek"` has no plural.
 * - Returns "" on invalid unit or failure.
 *
 * @param unit unit to extract from current utc instant
 * @returns string representation of the requested unit or "" on invalid
 *
 * @example getUtcNowUnit("year") // "2024"
 * @example getUtcNowUnit("month") // "02"
 * @example getUtcNowUnit("hours") // "14", if the UTC time is 14:xx (plural unit name)
 * @example getUtcNowUnit("invalid") // ""
 */
export function getUtcNowUnit(unit: UtcNowUnit): string {
  if (typeof unit !== "string") {
    return "";
  }

  const resolvedUnit = resolveDateTimeUnit(unit);
  if (!isValidUtcNowUnit(resolvedUnit)) return "";

  try {
    const now = Temporal.Now.instant().toZonedDateTimeISO("UTC");
    return zonedNowUnitValue(now, resolvedUnit, isoWeekOfYear);
  } catch {
    return "";
  }
}
