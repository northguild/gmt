import type { Temporal } from "@js-temporal/polyfill";
import {
  durationUntilString,
  isCalendarDifferenceAcrossZones,
  parseCalendarZonedPairForArithmetic,
} from "../../internal";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type {
  DateTimeDurationUnit,
  DurationStringOptions,
  RoundingOptions,
} from "../../types";
import { isValidCalendarZonedDateTime } from "../validate";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the difference between two zoned datetimes as an ISO 8601 duration string,
 * bridging to the `duration` namespace (see `parseDuration`, `normalizeDuration`).
 *
 * - Uses Temporal.ZonedDateTime.until with `largestUnit` set to `unit`, then `.toString()`.
 * - Measures like `diffZoned` (Temporal's DifferenceZonedDateTime): calendar units on the zone's
 *   own wall clock, time units in exact elapsed time. Values in different time zones with a
 *   calendar `unit` (days or larger) return "".
 * - Compatibility: before 1.16.0 both values were converted to UTC first. To get that value:
 *   `diffUtcAsDuration(convertZonedToUtc(value1), convertZonedToUtc(value2), unit)`.
 * - Accepts RFC 9557 calendar-annotated zoned strings, with the same calendar rule as `diffZoned`:
 *   measured in the shared calendar, `""` when the two name different calendars (TC39
 *   `CalendarEquals`; before 1.16.0 measured in ISO).
 * - Unlike `diffZoned`, `unit` is a single unit (not an array) — an ISO duration string
 *   already expresses a full multi-unit breakdown via `largestUnit` alone, so there's no
 *   array-of-units overload here.
 * - Returns `""` for invalid input (negative diffs are valid and render with a leading `-`).
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the
 * underlying difference before it's rendered, per Temporal's DifferenceOptions — same as
 * `diffZoned`. `toStringSmallestUnit`, `fractionalSecondDigits`, and `toStringRoundingMode`
 * control the precision of the rendered string itself, per Temporal's ToStringPrecisionOptions
 * (mirroring `parseDuration`'s options) — kept separate from the `.until()` rounding options
 * above because both option sets have colliding `smallestUnit`/`roundingMode` keys with
 * different Temporal types.
 *
 * - Compatibility: since 1.16.0 calendar strings are RFC 9557 (ISO digits, the `[u-ca=<id>]`
 *   annotation after the zone, canonical calendar ids); see `isValidCalendarZonedDateTime`.
 *
 * @param value1 zoned ISO 8601 datetime string (start), optionally calendar-annotated
 * @param value2 zoned ISO 8601 datetime string (end), optionally calendar-annotated
 * @param unit date-time unit to use as the duration's largestUnit, singular or plural (`"day"` or `"days"`)
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (.until() rounding); toStringSmallestUnit, fractionalSecondDigits, toStringRoundingMode (.toString() precision); a non-object value (such as `null`) is invalid
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example diffZonedAsDuration("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]", "days") // "P2D" (wall-clock days; 47 elapsed hours)
 * @example diffZonedAsDuration("2028-01-01T00:00:00+00:00[UTC]", "2028-01-01T00:00:00+00:00[UTC]", "hours") // "PT0S"
 * @example diffZonedAsDuration("2028-01-01T00:00:00+00:00[UTC]", "2028-01-02T13:00:00+13:00[Pacific/Apia]", "days") // "" (calendar unit across two time zones)
 * @example diffUtcAsDuration(convertZonedToUtc("2024-03-09T12:00:00-05:00[America/New_York]"), convertZonedToUtc("2024-03-11T12:00:00-04:00[America/New_York]"), "days") // "P1DT23H" (pre-1.16.0 UTC-clock result)
 * @example diffZonedAsDuration("invalid", "2028-01-01T00:00:00+00:00[UTC]", "days") // ""
 * @example diffZonedAsDuration("2023-09-16T00:00:00-04:00[America/New_York][u-ca=hebrew]", "2024-10-03T00:00:00-04:00[America/New_York][u-ca=hebrew]", "months") // "P13M" (Hebrew leap year 5784)
 * @example diffZonedAsDuration("2024-03-10T14:30:00-04:00[u-ca=hebrew][America/New_York]", "2024-03-11T14:30:00-04:00[America/New_York]", "days") // "" (calendar before zone is not RFC 9557)
 */
export function diffZonedAsDuration(
  value1: string,
  value2: string,
  unit: DateTimeDurationUnit | Temporal.DateTimeUnit,
  options?: RoundingOptions<Temporal.DateTimeUnit> & DurationStringOptions,
): string {
  // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
  if (!isOptionsArgument(options)) {
    return "";
  }
  const validZonedDateTimes =
    isValidCalendarZonedDateTime(value1) &&
    isValidCalendarZonedDateTime(value2);
  // Singular names resolve to their plural (Temporal §13.17).
  const resolvedUnit = resolveDurationUnit(unit);
  const validUnit = isValidDateTimeDurationUnit(resolvedUnit);

  if (!validZonedDateTimes || !validUnit) {
    return "";
  }

  try {
    const { a, b } = parseCalendarZonedPairForArithmetic(value1, value2);
    if (isCalendarDifferenceAcrossZones(a, b, resolvedUnit)) {
      return "";
    }

    return durationUntilString(a, b, resolvedUnit, options);
  } catch {
    return "";
  }
}
