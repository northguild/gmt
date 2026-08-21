import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";
import { isValidDuration } from "../validate/isValidDuration";

/**
 * Read a single component out of an ISO 8601 duration string.
 *
 * - Uses Temporal.Duration.from and reads the named field directly — this is the value as
 *   *stored*, not a converted total: getDurationUnit("PT90M", "hours") is 0, because "PT90M"
 *   holds 90 in its minutes field and nothing in its hours field. Use `durationAs` for a
 *   converted total.
 * - Never needs `relativeTo`: reading a field is not a unit conversion, so calendar units
 *   (years/months/weeks) work here even though they require an anchor in `durationAs`.
 * - Temporal balances fractional units at parse time, so getDurationUnit("PT1.5H", "minutes")
 *   is 30 — the input's own precision, not the caller's spelling of it, decides the fields.
 * - A negative duration stores *every* field as negative, so this returns a negative number
 *   for each nonzero component of "-P1DT2H", not just the leading one.
 * - Returns null when `value` is not a valid duration string or `unit` is not a valid
 *   DateTimeDurationUnit.
 *
 * @param value ISO 8601 duration string
 * @param unit DateTimeDurationUnit to read ("years" | "months" | "weeks" | "days" | "hours" | "minutes" | "seconds" | "milliseconds" | "microseconds" | "nanoseconds")
 * @returns the component's value, or null on invalid input
 *
 * @example getDurationUnit("P1DT2H30M", "hours") // 2
 * @example getDurationUnit("P1DT2H30M", "minutes") // 30
 * @example getDurationUnit("PT90M", "hours") // 0 (stored as minutes, not converted)
 * @example getDurationUnit("-P1DT2H", "hours") // -2
 * @example getDurationUnit("P1M", "months") // 1 (no relativeTo needed to read a field)
 * @example getDurationUnit("PT0S", "days") // 0
 * @example getDurationUnit("not a duration", "hours") // null
 * @example getDurationUnit("P1D", "fortnights") // null
 */
export function getDurationUnit(
  value: string,
  unit: DateTimeDurationUnit,
): number | null {
  if (!isValidDuration(value) || !isValidDateTimeDurationUnit(unit)) {
    return null;
  }

  try {
    return Temporal.Duration.from(value)[unit];
  } catch {
    return null;
  }
}
