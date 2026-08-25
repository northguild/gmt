import type { Temporal } from "@js-temporal/polyfill";
import { parseCalendarZonedPairForArithmetic } from "../../internal";
import { getLargestDateTimeDurationUnit } from "../../plain/calculate/getLargestDateTimeDurationUnit";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, RoundingOptions } from "../../types";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return the difference between two zoned datetimes measured in the given date-time unit.
 *
 * - Uses Temporal.ZonedDateTime.until to calculate difference.
 * - Converts both to UTC for consistent calculation.
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
 *   array (e.g. `["day", "hour"]` with `smallestUnit: "week"`) — this combination is rejected by
 *   Temporal and returns null, same as other invalid input.
 *
 * @param value1 zoned ISO 8601 datetime string (start), optionally calendar-annotated
 * @param value2 zoned ISO 8601 datetime string (end), optionally calendar-annotated
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls)
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffZoned("2024-02-28T14:30:00+00:00[UTC]", "2024-03-01T15:30:00+00:00[UTC]", "days") // 2
 * @example diffZoned("invalid", "2024-03-01T15:30:00+00:00[UTC]", "days") // null
 * @example diffZoned("5784-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]", "5785-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]", "months") // 13 (Hebrew leap year; the ISO equivalent is 12)
 * @example diffZoned("5784-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]", "1446-03-30T00:00:00-04:00[u-ca=islamic-tabular][America/New_York]", "hours") // measured in Gregorian/ISO (mismatched tags fall back rather than returning null)
 * @example diffZoned("2024-03-10T14:30:00-04:00[America/New_York][u-ca=hebrew]", "2024-03-11T14:30:00-04:00[America/New_York]", "days") // null (Temporal's segment ordering is not GMT's grammar)
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
    // Calendar resolution has to happen BEFORE the UTC normalization, and the normalization has
    // to preserve the calendar rather than discard it — the two are independent axes.
    // `withTimeZone` keeps the calendar tag intact (verified), so re-zoning both operands to UTC
    // still measures in the pair's resolved calendar.
    const { a, b } = parseCalendarZonedPairForArithmetic(value1, value2);
    const normalizedZdt1 = a.withTimeZone("UTC");
    const normalizedZdt2 = b.withTimeZone("UTC");

    const duration = normalizedZdt1.until(normalizedZdt2, {
      largestUnit: isSingleUnit ? units : getLargestDateTimeDurationUnit(units),
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
