import type { Temporal } from "@js-temporal/polyfill";
import type { DateTimeDurationUnit, DateTimeUnit } from "../types";

/**
 * Singular DateTimeUnit to its `Temporal.Duration` field name.
 *
 * Example lookups:
 * - DURATION_FIELD_BY_UNIT.day => "days"
 * - DURATION_FIELD_BY_UNIT.nanosecond => "nanoseconds"
 */
const DURATION_FIELD_BY_UNIT = {
  year: "years",
  month: "months",
  week: "weeks",
  day: "days",
  hour: "hours",
  minute: "minutes",
  second: "seconds",
  millisecond: "milliseconds",
  microsecond: "microseconds",
  nanosecond: "nanoseconds",
} as const satisfies Record<DateTimeUnit, DateTimeDurationUnit>;

/**
 * Return the start of the specified date-time `unit` for a `Temporal.ZonedDateTime`.
 *
 * - Always uses Monday as the week start (consistent with `startOfZoned` semantics).
 * - Day-and-below units truncate by instant via `round({ roundingMode: "trunc" })`, which
 *   resolves DST correctly — a local day whose midnight is skipped starts at 01:00.
 * - Does NOT validate the unit — caller ensures it is a DateTimeUnit.
 *
 * @param source Temporal.ZonedDateTime to truncate
 * @param unit DateTimeUnit to truncate to
 * @returns Temporal.ZonedDateTime at the start of the specified unit
 */
export function getStartOfZonedUnit(
  source: Temporal.ZonedDateTime,
  unit: DateTimeUnit,
): Temporal.ZonedDateTime {
  switch (unit) {
    case "year":
      return source
        .with({ month: 1, day: 1 })
        .round({ smallestUnit: "day", roundingMode: "trunc" });
    case "month":
      return source
        .with({ day: 1 })
        .round({ smallestUnit: "day", roundingMode: "trunc" });
    case "week":
      return source
        .subtract({ days: source.dayOfWeek - 1 })
        .round({ smallestUnit: "day", roundingMode: "trunc" });
    default:
      return source.round({ smallestUnit: unit, roundingMode: "trunc" });
  }
}

/**
 * Extract the whole-unit span from a `Temporal.Duration` measured with `largestUnit: unit`.
 *
 * - Floors the field so a partial trailing amount never inflates a boundary count.
 * - Does NOT validate the unit — caller ensures the duration was measured in it.
 *
 * @param duration Temporal.Duration produced by `until({ largestUnit: unit })`
 * @param unit DateTimeUnit the duration was measured in
 * @returns whole number of units spanned
 */
export function getUnitSpan(
  duration: Temporal.Duration,
  unit: DateTimeUnit,
): number {
  return Math.floor(duration[DURATION_FIELD_BY_UNIT[unit]]);
}
