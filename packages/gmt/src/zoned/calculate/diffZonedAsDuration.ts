import type { Temporal } from "@js-temporal/polyfill";
import {
  durationUntilString,
  parseCalendarZonedPairForArithmetic,
} from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type {
  DateTimeDurationUnit,
  DurationStringOptions,
  RoundingOptions,
} from "../../types";
import { isValidCalendarZonedDateTime } from "../validate";

/**
 * Return the difference between two zoned datetimes as an ISO 8601 duration string,
 * bridging to the `duration` namespace (see `parseDuration`, `normalizeDuration`).
 *
 * - Uses Temporal.ZonedDateTime.until with `largestUnit` set to `unit`, then `.toString()`.
 * - Converts both to UTC for consistent calculation, same as `diffZoned`.
 * - Accepts GMT calendar-annotated zoned strings, with the same shared-calendar-or-Gregorian-
 *   fallback policy as `diffZoned` (E7's D5-zoned, issue #152).
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
 * @param value1 zoned ISO 8601 datetime string (start), optionally calendar-annotated
 * @param value2 zoned ISO 8601 datetime string (end), optionally calendar-annotated
 * @param unit DateTimeDurationUnit to use as the duration's largestUnit
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (.until() rounding); toStringSmallestUnit, fractionalSecondDigits, toStringRoundingMode (.toString() precision)
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example diffZonedAsDuration("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]", "days") // "P1DT23H"
 * @example diffZonedAsDuration("2028-01-01T00:00:00+00:00[UTC]", "2028-01-01T00:00:00+00:00[UTC]", "hours") // "PT0S"
 * @example diffZonedAsDuration("invalid", "2028-01-01T00:00:00+00:00[UTC]", "days") // ""
 * @example diffZonedAsDuration("5784-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]", "5785-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]", "months") // "P13M" (Hebrew leap year)
 * @example diffZonedAsDuration("2024-03-10T14:30:00-04:00[America/New_York][u-ca=hebrew]", "2024-03-11T14:30:00-04:00[America/New_York]", "days") // "" (Temporal's segment ordering is not GMT's grammar)
 */
export function diffZonedAsDuration(
  value1: string,
  value2: string,
  unit: DateTimeDurationUnit,
  options?: RoundingOptions<Temporal.DateTimeUnit> & DurationStringOptions,
): string {
  const validZonedDateTimes =
    isValidCalendarZonedDateTime(value1) &&
    isValidCalendarZonedDateTime(value2);
  const validUnit = isValidDateTimeDurationUnit(unit);

  if (!validZonedDateTimes || !validUnit) {
    return "";
  }

  try {
    // Calendar resolution before UTC normalization, and the normalization preserves the calendar
    // — see `diffZoned`'s equivalent comment.
    const { a, b } = parseCalendarZonedPairForArithmetic(value1, value2);
    const normalizedZdt1 = a.withTimeZone("UTC");
    const normalizedZdt2 = b.withTimeZone("UTC");

    return durationUntilString(normalizedZdt1, normalizedZdt2, unit, options);
  } catch {
    return "";
  }
}
