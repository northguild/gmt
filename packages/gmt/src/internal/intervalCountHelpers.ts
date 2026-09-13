import type { Temporal } from "@js-temporal/polyfill";
import type { DateTimeDurationUnit, DateTimeUnit } from "../types";

/**
 * Singular DateTimeUnit to its `Temporal.Duration` field name.
 *
 * Example lookups:
 * - DURATION_FIELD_BY_UNIT.day => "days"
 * - DURATION_FIELD_BY_UNIT.nanosecond => "nanoseconds"
 */
export const DURATION_FIELD_BY_UNIT = {
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
