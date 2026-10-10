import type { Temporal } from "@js-temporal/polyfill";
import { zonedNowUnitValue } from "../../internal/zonedNowUnitValue";
import { parseWeekFromDate } from "../../plain/parse";
import { frameNowWallClock, zoneFrame } from "../../internal/zoneFrame";
import { resolveDateTimeUnit } from "../../internal/resolveDateTimeUnit";

/**
 * Units extractable from the current time in a specific IANA timeZone, as
 * consumed by `getZonedNowUnit`.
 *
 * @remarks Members:
 *
 * | Member | Description |
 * | --- | --- |
 * | `year` | Four digits (e.g. `2024`, `0005`); a sign and six digits outside 0000–9999 (e.g. `+010000`). |
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
 * - The `"year"` unit is written as Temporal writes a year: four digits (`"2024"`, `"0005"`), or a
 *   sign and six digits outside 0000–9999 (`"+010000"`, `"-000005"`).
 *
 * @param ianaTimezone IANA name or UTC offset: a time zone identifier (`+05:30`, `+0530`, `-08`) or
 *   a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
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
  if (typeof unit !== "string") {
    return "";
  }

  const resolvedUnit = resolveDateTimeUnit(unit);
  const frame = zoneFrame(ianaTimezone);

  if (frame === null || !isValidZonedNowUnit(resolvedUnit)) {
    return "";
  }

  try {
    const now = frameNowWallClock(frame);

    return zonedNowUnitValue(now, resolvedUnit, (wallClock) => {
      const w = parseWeekFromDate(wallClock.toPlainDate().toString());
      return w === null ? "" : w.toString();
    });
  } catch {
    return "";
  }
}
