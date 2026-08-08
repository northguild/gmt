import { Temporal } from "@js-temporal/polyfill";
import { durationUntilString } from "../../internal";
import type {
  DateTimeDurationUnit,
  DurationStringOptions,
  RoundingOptions,
} from "../../types";
import { isValidDateTime, isValidDateTimeDurationUnit } from "../validate";

/**
 * Return the difference between two PlainDateTime values as an ISO 8601 duration string,
 * bridging to the `duration` namespace (see `parseDuration`, `normalizeDuration`).
 *
 * - Returns `""` for invalid inputs (negative diffs are valid and render with a leading `-`).
 * - Uses Temporal.PlainDateTime.until with `largestUnit` set to `unit`, then `.toString()`.
 * - Unlike `diffDateTime`, `unit` is a single unit (not an array) — an ISO duration string
 *   already expresses a full multi-unit breakdown via `largestUnit` alone, so there's no
 *   array-of-units overload here.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the
 * underlying difference before it's rendered, per Temporal's DifferenceOptions — same as
 * `diffDateTime`. `toStringSmallestUnit`, `fractionalSecondDigits`, and `toStringRoundingMode`
 * control the precision of the rendered string itself, per Temporal's ToStringPrecisionOptions
 * (mirroring `parseDuration`'s options) — kept separate from the `.until()` rounding options
 * above because both option sets have colliding `smallestUnit`/`roundingMode` keys with
 * different Temporal types.
 *
 * @param dateTime1 ISO PlainDateTime string for the start
 * @param dateTime2 ISO PlainDateTime string for the end
 * @param unit DateTimeDurationUnit to use as the duration's largestUnit
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (.until() rounding); toStringSmallestUnit, fractionalSecondDigits, toStringRoundingMode (.toString() precision)
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example diffDateTimeAsDuration("2024-03-10T00:00:00", "2024-03-11T02:00:00", "days") // "P1DT2H"
 * @example diffDateTimeAsDuration("2024-03-11T02:00:00", "2024-03-10T00:00:00", "days") // "-P1DT2H"
 * @example diffDateTimeAsDuration("2024-01-01T00:00:00", "2024-01-01T00:00:00", "days") // "PT0S"
 * @example diffDateTimeAsDuration("invalid", "2024-03-15T12:00:00", "days") // ""
 * @example diffDateTimeAsDuration("2024-02-29T00:00:00", "2024-02-29T01:30:00", "hours", { smallestUnit: "hours", roundingMode: "halfExpand" }) // "PT2H"
 */
export function diffDateTimeAsDuration(
  dateTime1: string,
  dateTime2: string,
  unit: DateTimeDurationUnit,
  options?: RoundingOptions<Temporal.DateTimeUnit> & DurationStringOptions,
): string {
  const validDateTimes =
    isValidDateTime(dateTime1) && isValidDateTime(dateTime2);
  const validUnit = isValidDateTimeDurationUnit(unit);

  if (!validDateTimes || !validUnit) {
    return "";
  }

  try {
    const dt1 = Temporal.PlainDateTime.from(dateTime1);
    const dt2 = Temporal.PlainDateTime.from(dateTime2);

    return durationUntilString(dt1, dt2, unit, options);
  } catch {
    return "";
  }
}
