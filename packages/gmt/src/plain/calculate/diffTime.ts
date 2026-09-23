// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { differenceRecord } from "../../internal/differenceRecord";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import type { RoundingOptions, TimeDurationUnit } from "../../types";
import { isValidTime, isValidTimeDurationUnit } from "../validate";
import { getLargestTimeDurationUnit } from "./getLargestTimeDurationUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the difference between two PlainTime values in the requested unit.
 *
 * - Returns `null` for invalid inputs.
 * - Uses Temporal.PlainTime.until with `largestUnit` and extracts the requested unit.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the result,
 * per Temporal's DifferenceOptions — e.g. `{ smallestUnit: "minute", roundingMode: "halfExpand" }`
 * rounds the difference to the nearest minute before extracting the requested unit.
 * - When `units` is an array, `smallestUnit` must not be coarser than the largest unit in the
 *   array (e.g. `["minutes", "seconds"]` with `smallestUnit: "hour"`) — this combination is
 *   rejected by Temporal and returns null, same as other invalid input.
 * - With an array of units, the record is the whole difference: the largest listed unit is
 *   Temporal's `largestUnit`, and the amount of each unlisted unit between two listed units is
 *   carried into the next smaller listed unit, measured from the start moved by the larger listed
 *   amounts (so adding the record to the start reaches the end). Units smaller than the smallest
 *   listed unit are truncated, as for a single unit. For example, `["hours", "seconds"]` over
 *   1 hour 30 minutes 15 seconds returns `{ hours: 1, seconds: 1815 }`.
 * - Nanosecond precision is always exact here, unlike `diffDateTime`/`diffUtc`/`diffUnix`: two
 *   plain times are less than a day apart, so the widest possible result,
 *   `diffTime("00:00:00.000000000", "23:59:59.999999999", "nanoseconds")` = `86399999999999`,
 *   is well inside `Number.MAX_SAFE_INTEGER`. Those three can span more than about 104 days, at
 *   which point a nanosecond count stops being a safe integer and the `bigint` APIs (`spanNs` in
 *   `span/`, `toNanoseconds` in `precision/`) are the exact ones.
 *
 * @param time1 ISO PlainTime string for the start
 * @param time2 ISO PlainTime string for the end
 * @param units TimeDurationUnit | TimeDurationUnit[] to measure the difference
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls); a non-object value (such as `null`) is invalid
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffTime("12:00:00", "14:30:00", "hours") // 2
 * @example diffTime("invalid", "14:30:00", "hours") // null
 * @example diffTime("10:00:00", "11:30:15", ["hours", "seconds"]) // { hours: 1, seconds: 1815 } (PT1H30M15S; the 30 minutes are carried into seconds)
 */
export function diffTime(
  time1: string,
  time2: string,
  units:
    | TimeDurationUnit
    | Temporal.TimeUnit
    | Array<TimeDurationUnit | Temporal.TimeUnit>,
  options?: RoundingOptions<Temporal.TimeUnit>,
): number | Record<TimeDurationUnit, number> | null {
  try {
    // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
    if (!isOptionsArgument(options)) {
      return null;
    }
    const validTimes = isValidTime(time1) && isValidTime(time2);
    // Singular names resolve to their plural (Temporal §13.17); record keys are the plural names.
    const resolved = Array.isArray(units)
      ? units.map((unit) => resolveDurationUnit(unit))
      : resolveDurationUnit(units);
    const isSingleUnit = !Array.isArray(resolved);
    const validUnits = isSingleUnit
      ? isValidTimeDurationUnit(resolved)
      : resolved.every(isValidTimeDurationUnit);

    if (!validTimes || !validUnits) {
      return null;
    }

    try {
      // An empty units list names no largest unit, so there is nothing to measure.
      const largestUnit = isSingleUnit
        ? (resolved as TimeDurationUnit)
        : getLargestTimeDurationUnit(resolved as TimeDurationUnit[]);
      if (largestUnit === "") return null;

      const t1 = Temporal.PlainTime.from(time1);
      const t2 = Temporal.PlainTime.from(time2);

      const duration = t1.until(t2, {
        largestUnit,
        smallestUnit: options?.smallestUnit,
        roundingIncrement: options?.roundingIncrement,
        roundingMode: options?.roundingMode,
      });

      // craft record for units passed
      if (isSingleUnit) {
        return duration[resolved as TimeDurationUnit] ?? 0;
      }

      // An unlisted unit between two listed units is carried into the next smaller listed unit.
      // Measured on one arbitrary day, because a rounded PlainTime end can pass midnight.
      const day = Temporal.PlainDate.from("2000-01-01");
      return differenceRecord(
        day.toPlainDateTime(t1),
        duration,
        resolved as TimeDurationUnit[],
        {
          add: (from, amount) => from.add(amount),
          until: (from, to, largest) =>
            from.until(to, { largestUnit: largest as Temporal.DateTimeUnit }),
        },
      ) as Record<TimeDurationUnit, number>;
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
