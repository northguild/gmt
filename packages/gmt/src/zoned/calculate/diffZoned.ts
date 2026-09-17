import type { Temporal } from "@js-temporal/polyfill";
import {
  isCalendarDifferenceAcrossZones,
  parseCalendarZonedPairForArithmetic,
  zonedUntil,
} from "../../internal";
import { getLargestDateTimeDurationUnit } from "../../plain/calculate/getLargestDateTimeDurationUnit";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, RoundingOptions } from "../../types";
import { isValidCalendarZonedDateTime } from "../validate";

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
 * - Accepts GMT calendar-annotated zoned strings (as produced by `convertZonedToCalendar`) —
 *   E7 (issue #152). When BOTH endpoints carry the same calendar tag, calendar units are measured
 *   in that calendar (a Hebrew leap year spans 13 month boundaries, not 14). When the tags
 *   mismatch, or either endpoint is a bare ISO string, the measurement falls back to
 *   Gregorian/ISO rather than returning the sentinel (E7's D5-zoned). That fallback is mandatory
 *   here, not a convenience: `Temporal.ZonedDateTime.prototype.until` throws across mismatched
 *   calendars for EVERY `largestUnit` — verified, including `"hour"` and `"nanosecond"` — so
 *   without it a purely time-unit question like "how many hours between these two moments" would
 *   return null just because the two strings named different calendars.
 * - Returns null for invalid input.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the result,
 * per Temporal's DifferenceOptions — e.g. `{ smallestUnit: "hour", roundingMode: "halfExpand" }`
 * rounds the difference to the nearest hour before extracting the requested unit.
 * - When `units` is an array, `smallestUnit` must not be coarser than the largest unit in the
 *   array (e.g. `["days", "hours"]` with `smallestUnit: "week"`) — this combination is rejected by
 *   Temporal and returns null, same as other invalid input.
 * - With an array of units, the largest listed unit is Temporal's `largestUnit` and only the listed
 *   units are returned. Amounts in units between the listed ones are computed and not returned —
 *   they are not carried into a smaller listed unit. For example, `["years", "days"]` over
 *   1 year 59 days returns `{ years: 1, days: 0 }` (the 2 months are dropped).
 * - Compatibility: since 1.16.0 a calendar annotation must be a GMT `CalendarSystem` id
 *   (`[u-ca=gregory]` is now invalid input); use the GMT id — see `isValidCalendarZonedDateTime`.
 *
 * @param value1 zoned ISO 8601 datetime string (start), optionally calendar-annotated
 * @param value2 zoned ISO 8601 datetime string (end), optionally calendar-annotated
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls)
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffZoned("2024-02-28T14:30:00+00:00[UTC]", "2024-03-01T15:30:00+00:00[UTC]", "days") // 2
 * @example diffZoned("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-10T12:00:00-04:00[America/New_York]", "days") // 1 (a 23-hour local day)
 * @example diffZoned("2024-01-01T00:00:00-05:00[America/New_York]", "2024-01-03T00:00:00+01:00[Europe/Paris]", "days") // null (calendar unit across two time zones)
 * @example diffUtc(convertZonedToUtc("2024-03-09T12:00:00-05:00[America/New_York]"), convertZonedToUtc("2024-03-10T12:00:00-04:00[America/New_York]"), "days") // 0 (pre-1.16.0 UTC-clock result)
 * @example diffZoned("invalid", "2024-03-01T15:30:00+00:00[UTC]", "days") // null
 * @example diffZoned("5784-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]", "5785-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]", "months") // 13 (Hebrew leap year; the ISO equivalent is 12)
 * @example diffZoned("5784-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]", "1446-03-30T00:00:00-04:00[u-ca=islamic-tabular][America/New_York]", "hours") // measured in Gregorian/ISO (mismatched tags fall back rather than returning null)
 * @example diffZoned("2024-03-10T14:30:00-04:00[America/New_York][u-ca=hebrew]", "2024-03-11T14:30:00-04:00[America/New_York]", "days") // null (Temporal's segment ordering is not GMT's grammar)
 * @example diffZoned("2024-01-01T00:00:00+00:00[UTC]", "2025-03-01T00:00:00+00:00[UTC]", ["years", "days"]) // { years: 1, days: 0 } (P1Y2M; the months are not returned)
 */
export function diffZoned(
  value1: string,
  value2: string,
  units: DateTimeDurationUnit | DateTimeDurationUnit[],
  options?: RoundingOptions<Temporal.DateTimeUnit>,
): number | Record<DateTimeDurationUnit, number> | null {
  const validZonedDateTimes =
    isValidCalendarZonedDateTime(value1) &&
    isValidCalendarZonedDateTime(value2);
  const isSingleUnit = !Array.isArray(units);
  const validUnits = isSingleUnit
    ? isValidDateTimeDurationUnit(units)
    : units.every(isValidDateTimeDurationUnit);

  if (!validZonedDateTimes || !validUnits) {
    return null;
  }

  try {
    const { a, b } = parseCalendarZonedPairForArithmetic(value1, value2);
    const largestUnit = isSingleUnit
      ? units
      : getLargestDateTimeDurationUnit(units);
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
      return duration[units] ?? 0;
    }

    return units.reduce(
      (result, unit) => {
        result[unit] = duration[unit] ?? 0;
        return result;
      },
      {} as Record<DateTimeDurationUnit, number>,
    );
  } catch {
    return null;
  }
}
