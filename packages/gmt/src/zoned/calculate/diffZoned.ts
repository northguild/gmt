// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import type { Temporal } from "@js-temporal/polyfill";
import {
  addToZoned,
  isCalendarDifferenceAcrossZones,
  parseCalendarZonedPairForArithmetic,
  zonedUntil,
} from "../../internal";
import { differenceRecord } from "../../internal/differenceRecord";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import { getLargestDateTimeDurationUnit } from "../../plain/calculate/getLargestDateTimeDurationUnit";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, RoundingOptions } from "../../types";
import { isValidCalendarZonedDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the difference between two zoned datetimes measured in the given date-time unit.
 *
 * - Uses Temporal.ZonedDateTime.until to calculate difference.
 * - Follows Temporal's DifferenceZonedDateTime: calendar units (days, weeks, months, years) are
 *   measured on the zone's own wall clock, so a 23-hour DST day is 1 day and a month from Jan 31
 *   follows the local date; time units (hours and smaller) are exact elapsed time.
 * - Two values in different time zones (by TC39 TimeZoneEquals, so `UTC` equals `Etc/UTC`) can
 *   only be differenced in time units: a calendar largest unit returns null, because day lengths
 *   differ between zones.
 * - Compatibility: before 1.16.0 both values were converted to UTC first, so calendar units were
 *   measured on the UTC clock and mixed zones were accepted. To get that value, difference the UTC
 *   instants: `diffUtc(convertZonedToUtc(value1), convertZonedToUtc(value2), units)`.
 * - Supports single unit or array of units.
 * - Accepts RFC 9557 calendar-annotated zoned strings (as `convertZonedToCalendar` writes them;
 *   E7, issue #152). When BOTH endpoints name the same calendar, calendar units are measured in
 *   that calendar (a Hebrew leap year spans 13 months, not 12). When they name different calendars
 *   (a bare ISO string names `iso8601`), the result is `null` for every unit, hours included, as
 *   TC39 `DifferenceTemporalZonedDateTime` throws when `CalendarEquals` is false.
 * - Compatibility: before 1.16.0 two different calendars were measured in ISO. To get that value,
 *   convert both to one calendar first: `convertZonedToCalendar(value, "iso8601")`.
 * - Returns null for invalid input.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the result,
 * per Temporal's DifferenceOptions — e.g. `{ smallestUnit: "hour", roundingMode: "halfExpand" }`
 * rounds the difference to the nearest hour before extracting the requested unit.
 * - When `units` is an array, `smallestUnit` must not be coarser than the largest unit in the
 *   array (e.g. `["days", "hours"]` with `smallestUnit: "week"`) — this combination is rejected by
 *   Temporal and returns null, same as other invalid input.
 * - With an array of units, the record is the whole difference: the largest listed unit is
 *   Temporal's `largestUnit`, and the amount of each unlisted unit between two listed units is
 *   carried into the next smaller listed unit, measured from the start moved by the larger listed
 *   amounts (so adding the record to the start reaches the end). Units smaller than the smallest
 *   listed unit are truncated, as for a single unit. For example, `["years", "days"]` over
 *   1 year 59 days returns `{ years: 1, days: 59 }`.
 *   Days carried into a time unit follow the zone's wall clock (a 23-hour DST day is 23 hours).
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, the `[u-ca=<id>]`
 *   annotation after the zone, canonical calendar ids); see `isValidCalendarZonedDateTime`.
 *
 * @param value1 zoned ISO 8601 datetime string (start), optionally calendar-annotated
 * @param value2 zoned ISO 8601 datetime string (end), optionally calendar-annotated
 * @param units date-time unit or units to measure the difference, singular or plural (`"day"` or
 *   `"days"`); a record result keeps the plural keys
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls); a non-object value (such as `null`) is invalid
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffZoned("2024-02-28T14:30:00+00:00[UTC]", "2024-03-01T15:30:00+00:00[UTC]", "days") // 2
 * @example diffZoned("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-10T12:00:00-04:00[America/New_York]", "days") // 1 (a 23-hour local day)
 * @example diffZoned("2024-01-01T00:00:00-05:00[America/New_York]", "2024-01-03T00:00:00+01:00[Europe/Paris]", "days") // null (calendar unit across two time zones)
 * @example diffUtc(convertZonedToUtc("2024-03-09T12:00:00-05:00[America/New_York]"), convertZonedToUtc("2024-03-10T12:00:00-04:00[America/New_York]"), "days") // 0 (pre-1.16.0 UTC-clock result)
 * @example diffZoned("2024-02-28T14:30:00+00:00[UTC]", "2024-03-01T15:30:00+00:00[UTC]", ["day", "hour"]) // { days: 2, hours: 1 } (singular names, plural keys)
 * @example diffZoned("invalid", "2024-03-01T15:30:00+00:00[UTC]", "days") // null
 * @example diffZoned("2023-09-16T00:00:00-04:00[America/New_York][u-ca=hebrew]", "2024-10-03T00:00:00-04:00[America/New_York][u-ca=hebrew]", "months") // 13 (Hebrew leap year 5784; the ISO equivalent is 12)
 * @example diffZoned("2023-09-16T00:00:00-04:00[America/New_York][u-ca=hebrew]", "2024-10-03T00:00:00-04:00[America/New_York][u-ca=islamic-tbla]", "hours") // null (different calendars)
 * @example diffZoned("2024-03-10T14:30:00-04:00[u-ca=hebrew][America/New_York]", "2024-03-11T14:30:00-04:00[America/New_York]", "days") // null (calendar before zone is not RFC 9557)
 * @example diffZoned("2024-01-01T00:00:00+00:00[UTC]", "2025-03-01T00:00:00+00:00[UTC]", ["years", "days"]) // { years: 1, days: 59 } (P1Y2M; the 2 months are carried into days)
 * @example diffZoned("2024-02-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]", ["months", "hours"]) // { months: 1, hours: 47 } (P1M2D; the 2 days include the 23-hour 2024-03-10)
 */
export function diffZoned(
  value1: string,
  value2: string,
  units:
    | DateTimeDurationUnit
    | Temporal.DateTimeUnit
    | Array<DateTimeDurationUnit | Temporal.DateTimeUnit>,
  options?: RoundingOptions<Temporal.DateTimeUnit>,
): number | Record<DateTimeDurationUnit, number> | null {
  try {
    // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
    if (!isOptionsArgument(options)) {
      return null;
    }
    const validZonedDateTimes =
      isValidCalendarZonedDateTime(value1) &&
      isValidCalendarZonedDateTime(value2);
    // Singular names resolve to their plural (Temporal §13.17); record keys are the plural names.
    const resolved = Array.isArray(units)
      ? units.map((unit) => resolveDurationUnit(unit))
      : resolveDurationUnit(units);
    const isSingleUnit = !Array.isArray(resolved);
    const validUnits = isSingleUnit
      ? isValidDateTimeDurationUnit(resolved)
      : resolved.every(isValidDateTimeDurationUnit);

    if (!validZonedDateTimes || !validUnits) {
      return null;
    }

    try {
      const { a, b } = parseCalendarZonedPairForArithmetic(value1, value2);
      const largestUnit = isSingleUnit
        ? (resolved as DateTimeDurationUnit)
        : getLargestDateTimeDurationUnit(resolved as DateTimeDurationUnit[]);
      if (largestUnit === "") return null;
      if (isCalendarDifferenceAcrossZones(a, b, largestUnit)) {
        return null;
      }

      const duration = zonedUntil(a, b, {
        largestUnit,
        smallestUnit: options?.smallestUnit,
        roundingIncrement: options?.roundingIncrement,
        roundingMode: options?.roundingMode,
      });

      if (isSingleUnit) {
        return duration[resolved as DateTimeDurationUnit] ?? 0;
      }

      // An unlisted unit between two listed units is carried into the next smaller listed unit.
      return differenceRecord(a, duration, resolved as DateTimeDurationUnit[], {
        add: (from, amount) => addToZoned(from, amount),
        until: (from, to, largest) =>
          zonedUntil(from, to, {
            largestUnit: largest as Temporal.DateTimeUnit,
          }),
      });
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
