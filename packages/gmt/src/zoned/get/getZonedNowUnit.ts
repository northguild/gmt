import { Temporal } from "@js-temporal/polyfill";
import { zonedNowUnitValue } from "../../internal/zonedNowUnitValue";
import { parseWeekFromDate } from "../../plain/parse";
import { isValidTimeZone } from "../validate";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";

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
 * | `microsecond` | Microseconds within the millisecond, 0–999, zero-padded to 3. |
 * | `nanosecond` | Nanoseconds within the microsecond, 0–999, zero-padded to 3. |
 *
 * @example
 * import { ZonedNowUnit } from "@northguild/gmt/zoned";
 * const u: ZonedNowUnit = "hour";
 */
export type ZonedNowUnit =
  | Temporal.SmallestUnit<
      | "year"
      | "month"
      | "week"
      | "day"
      | "hour"
      | "minute"
      | "second"
      | "millisecond"
      | "microsecond"
      | "nanosecond"
    >
  | "dayOfWeek";

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
 * - `week` is the ISO 8601 week number, from `parseWeekFromDate`.
 * - Validation is performed on timezone and unit.
 * - `unit` accepts the singular or plural name of a Temporal unit (`"hour"` or `"hours"`), as Temporal
 *   does; `"dayOfWeek"` has no plural.
 *
 * @param ianaTimezone IANA timeZone identifier
 * @param unit unit to extract from current zoned time
 * @returns string representation of the requested unit or "" on invalid input
 *
 * @example getZonedNowUnit("America/New_York", "hour") // "07"
 * @example getZonedNowUnit("UTC", "hours") // "14", if the UTC time is 14:xx (plural unit name)
 * @example getZonedNowUnit("invalid", "hour") // ""
 */
export function getZonedNowUnit(
  ianaTimezone: string,
  unit: ZonedNowUnit,
): string {
  const resolvedUnit = resolveDateTimeUnit(unit);
  if (
    !isValidTimeZone(ianaTimezone) ||
    !isValidZonedNowUnit(String(resolvedUnit ?? ""))
  ) {
    return "";
  }

  try {
    const now = Temporal.Now.zonedDateTimeISO(ianaTimezone);

    return zonedNowUnitValue(now, resolvedUnit, (zdt) => {
      const w = parseWeekFromDate(zdt.toPlainDate().toString());
      return w === null ? "" : w.toString();
    });
  } catch {
    return "";
  }
}
