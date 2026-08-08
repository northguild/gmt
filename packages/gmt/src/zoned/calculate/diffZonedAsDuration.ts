import { Temporal } from "@js-temporal/polyfill";
import { durationUntilString } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type {
  DateTimeDurationUnit,
  DurationStringOptions,
  RoundingOptions,
} from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the difference between two zoned datetimes as an ISO 8601 duration string,
 * bridging to the `duration` namespace (see `parseDuration`, `normalizeDuration`).
 *
 * - Uses Temporal.ZonedDateTime.until with `largestUnit` set to `unit`, then `.toString()`.
 * - Converts both to UTC for consistent calculation, same as `diffZoned`.
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
 * @param value1 zoned ISO 8601 datetime string (start)
 * @param value2 zoned ISO 8601 datetime string (end)
 * @param unit DateTimeDurationUnit to use as the duration's largestUnit
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (.until() rounding); toStringSmallestUnit, fractionalSecondDigits, toStringRoundingMode (.toString() precision)
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example diffZonedAsDuration("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-11T12:00:00-04:00[America/New_York]", "days") // "P1DT23H"
 * @example diffZonedAsDuration("2028-01-01T00:00:00+00:00[UTC]", "2028-01-01T00:00:00+00:00[UTC]", "hours") // "PT0S"
 * @example diffZonedAsDuration("invalid", "2028-01-01T00:00:00+00:00[UTC]", "days") // ""
 */
export function diffZonedAsDuration(
  value1: string,
  value2: string,
  unit: DateTimeDurationUnit,
  options?: RoundingOptions<Temporal.DateTimeUnit> & DurationStringOptions,
): string {
  const validZonedDateTimes =
    isValidZonedDateTime(value1) && isValidZonedDateTime(value2);
  const validUnit = isValidDateTimeDurationUnit(unit);

  if (!validZonedDateTimes || !validUnit) {
    return "";
  }

  try {
    const normalizedZdt1 =
      Temporal.ZonedDateTime.from(value1).withTimeZone("UTC");
    const normalizedZdt2 =
      Temporal.ZonedDateTime.from(value2).withTimeZone("UTC");

    return durationUntilString(normalizedZdt1, normalizedZdt2, unit, options);
  } catch {
    return "";
  }
}
