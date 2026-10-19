import { Temporal } from "../../internal/temporal";
import { readDurationUnits } from "../../internal";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";

/**
 * Write an amount given as a unit object, such as `{ minutes: 15 }`, as an ISO 8601 duration
 * string.
 *
 * - Uses Temporal.Duration.from to read the fields, then .toString() to write them.
 * - Which function to use: `durationFromUnits` turns a unit object into the duration string that
 *   the other duration functions take. `totalUnits` totals a unit object of exact units in one
 *   call. `totalDuration` totals a duration string.
 * - Takes all ten units, from years down to nanoseconds: writing a year, a month or a week needs
 *   no date to measure from. To total a calendar amount, pass the result to `totalDuration` with
 *   `relativeTo`.
 * - Years down to minutes are written as given, and nothing is carried into a larger unit:
 *   `{ minutes: 90 }` is "PT90M". `normalizeDuration` with `largestUnit` carries it.
 * - Seconds, milliseconds, microseconds and nanoseconds are written together as one decimal
 *   number of seconds, as Temporal's `Duration.prototype.toString` writes them:
 *   `{ milliseconds: 1500 }` is "PT1.5S". Reading that string back gives 1 second and 500
 *   milliseconds.
 * - A zero amount is "PT0S", the one spelling Temporal writes for every zero duration.
 * - Every key is a unit name in the plural, and every amount is a whole finite number. All
 *   nonzero amounts share one sign, as Temporal requires of a duration. A unit set to `undefined`
 *   is absent, as Temporal reads it.
 * - An unknown key returns "", even beside a valid one. Temporal on its own ignores an unknown
 *   key, so a misspelt `{ minutes: 15, hour: 1 }` would be written "PT15M" with no warning.
 * - Returns "" on an object with no unit, a non-object `units` (a duration string included), an
 *   invalid amount, or an amount past Temporal's duration range.
 *
 * @param units Partial<Record<DateTimeDurationUnit, number>> object holding the amount to write
 * @returns ISO 8601 duration string, or "" on invalid input
 *
 * @example durationFromUnits({ minutes: 15 }) // "PT15M"
 * @example durationFromUnits({ days: 1, hours: 12 }) // "P1DT12H"
 * @example durationFromUnits({ minutes: 90 }) // "PT90M" (not carried into hours)
 * @example durationFromUnits({ years: 1, months: 2 }) // "P1Y2M"
 * @example durationFromUnits({ weeks: 1 }) // "P1W"
 * @example durationFromUnits({ milliseconds: 1500 }) // "PT1.5S"
 * @example durationFromUnits({ seconds: 59, milliseconds: 1500 }) // "PT60.5S" (one decimal number of seconds)
 * @example durationFromUnits({ minutes: 15, hours: undefined }) // "PT15M" (an undefined unit is absent)
 * @example durationFromUnits({ minutes: -15 }) // "-PT15M"
 * @example durationFromUnits({ minutes: 0 }) // "PT0S"
 * @example durationFromUnits({ minutes: 15, hour: 1 }) // "" (unknown key "hour")
 * @example durationFromUnits({ minutes: 1.5 }) // "" (fractional amount)
 * @example durationFromUnits({ hours: 1, minutes: -30 }) // "" (mixed signs)
 * @example durationFromUnits({}) // ""
 * @example durationFromUnits("PT15M") // "" (already a duration string)
 */
export function durationFromUnits(
  units: Partial<Record<DateTimeDurationUnit, number>>,
): string {
  try {
    const amounts = readDurationUnits(units, isValidDateTimeDurationUnit);

    if (amounts === null) {
      return "";
    }

    try {
      return Temporal.Duration.from(amounts).toString();
    } catch {
      return "";
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
