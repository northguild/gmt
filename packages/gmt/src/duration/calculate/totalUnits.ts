import { Temporal } from "@js-temporal/polyfill";
import { durationTotal, readDurationUnits } from "../../internal";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import { isValidTimeDurationUnit } from "../../plain/validate";
import type { ExactDurationUnit, TimeUnit } from "../../types";

/** Whether `unit` has an exact length: `"days"` (24 hours with no anchor) or a time unit. */
const isExactDurationUnit = (unit: string): unit is ExactDurationUnit =>
  unit === "days" || isValidTimeDurationUnit(unit);

/**
 * Express an amount written as a unit object, such as `{ minutes: 15 }`, as a single fractional
 * total in one unit.
 *
 * - Uses Temporal.Duration.from and .total: every field is converted, so
 *   totalUnits({ days: 1, hours: 12 }, "seconds") is 129600.
 * - Which function to use: `totalUnits` takes a unit object. `totalDuration` takes an ISO 8601
 *   duration string (`"PT15M"`). `durationFromUnits` turns a unit object into the duration string
 *   that the other duration functions take.
 * - Takes exact units only: days, hours, minutes, seconds, milliseconds, microseconds and
 *   nanoseconds. A day is 24 hours, as Temporal's `Duration.prototype.total` reads a day when it
 *   has no `relativeTo`. For a day in a time zone, which can be 23 or 25 hours across a clock
 *   change, use `totalDuration` with a zoned `relativeTo`.
 * - A year, a month or a week returns null, as a key and as `unit`: Temporal gives them no length
 *   without a date to measure from. Write a week as `{ days: 7 }`. For a calendar amount, build
 *   the string with `durationFromUnits` and pass it to `totalDuration` with `relativeTo`.
 * - The result is fractional, not rounded: totalUnits({ hours: 36 }, "days") is 1.5. It is a
 *   JavaScript number, so a total past 2^53 is the nearest double.
 * - Every key is a unit name in the plural, and every amount is a whole finite number. All
 *   nonzero amounts share one sign, as Temporal requires of a duration. A unit set to `undefined`
 *   is absent, as Temporal reads it.
 * - An unknown key returns null, even beside a valid one. Temporal on its own ignores an unknown
 *   key, so a misspelt `{ minutes: 15, hour: 1 }` would total 900 with no warning.
 * - `unit` accepts the plural or singular name (`"seconds"` or `"second"`), as Temporal does.
 * - Returns null on an object with no unit, a non-object `units` (a duration string included), an
 *   invalid amount, an amount past Temporal's duration range, or an invalid `unit`.
 *
 * @param units Partial<Record<ExactDurationUnit, number>> object holding the amount to total
 * @param unit ExactDurationUnit to total into ("days" | "hours" | "minutes" | "seconds" | "milliseconds" | "microseconds" | "nanoseconds", or the singular name)
 * @returns the fractional total in `unit`, or null on invalid input
 *
 * @example totalUnits({ minutes: 15 }, "seconds") // 900
 * @example totalUnits({ days: 30 }, "seconds") // 2592000
 * @example totalUnits({ days: 1, hours: 12 }, "seconds") // 129600
 * @example totalUnits({ hours: 36 }, "days") // 1.5
 * @example totalUnits({ minutes: -90 }, "hours") // -1.5
 * @example totalUnits({ seconds: 10 }, "millisecond") // 10000 (singular unit name)
 * @example totalUnits({ minutes: 0 }, "seconds") // 0
 * @example totalUnits({ minutes: 15, hours: undefined }, "seconds") // 900 (an undefined unit is absent)
 * @example totalUnits({ weeks: 1 }, "days") // null (a week has no exact length; write { days: 7 })
 * @example totalUnits({ days: 7 }, "weeks") // null (a week has no exact length)
 * @example totalUnits({ minutes: 15, hour: 1 }, "seconds") // null (unknown key "hour")
 * @example totalUnits({ minutes: 1.5 }, "seconds") // null (fractional amount)
 * @example totalUnits({ hours: 1, minutes: -30 }, "seconds") // null (mixed signs)
 * @example totalUnits({}, "seconds") // null
 * @example totalUnits("PT15M", "seconds") // null (a duration string goes to totalDuration)
 */
export function totalUnits(
  units: Partial<Record<ExactDurationUnit, number>>,
  unit: ExactDurationUnit | "day" | TimeUnit,
): number | null {
  try {
    const resolvedUnit = resolveDurationUnit(unit);
    const amounts = readDurationUnits(units, isExactDurationUnit);

    if (!isExactDurationUnit(resolvedUnit) || amounts === null) {
      return null;
    }

    try {
      return durationTotal(Temporal.Duration.from(amounts), resolvedUnit);
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
