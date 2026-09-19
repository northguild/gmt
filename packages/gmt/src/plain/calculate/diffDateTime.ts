// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "@js-temporal/polyfill";
import { differenceRecord } from "../../internal/differenceRecord";
import { resolveDurationUnit } from "../../internal/resolveDurationUnit";
import type { DateTimeDurationUnit, RoundingOptions } from "../../types";
import { isValidDateTime, isValidDateTimeDurationUnit } from "../validate";
import { getLargestDateTimeDurationUnit } from "./getLargestDateTimeDurationUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the difference between two PlainDateTime values in the requested unit.
 *
 * - Returns `null` for invalid inputs (negative diffs are valid).
 * - Uses Temporal.PlainDateTime.until and extracts the requested unit.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the result,
 * per Temporal's DifferenceOptions — e.g. `{ smallestUnit: "hour", roundingMode: "halfExpand" }`
 * rounds the difference to the nearest hour before extracting the requested unit.
 * - When `units` is an array, `smallestUnit` must not be coarser than the largest unit in the
 *   array (e.g. `["days", "hours"]` with `smallestUnit: "week"`) — this combination is rejected by
 *   Temporal and returns null, same as other invalid input.
 * - With an array of units, the record is the whole difference: the largest listed unit is
 *   Temporal's `largestUnit`, and the amount of each unlisted unit between two listed units is
 *   carried into the next smaller listed unit, measured from the start moved by the larger listed
 *   amounts (so adding the record to the start reaches the end). Units smaller than the smallest
 *   listed unit are truncated, as for a single unit. For example, `["years", "days"]` over
 *   1 year 59 days returns `{ years: 1, days: 59 }`.
 *
 * @param dateTime1 ISO PlainDateTime string for the start
 * @param dateTime2 ISO PlainDateTime string for the end
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls); a non-object value (such as `null`) is invalid
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffDateTime("2024-03-10T12:00:00", "2024-03-15T12:00:00", "days") // 5
 * @example diffDateTime("invalid", "2024-03-15T12:00:00", "days") // null
 * @example diffDateTime("2024-01-01T00:00:00", "2025-03-01T00:00:00", ["years", "days"]) // { years: 1, days: 59 } (P1Y2M; the 2 months are carried into days)
 */
export function diffDateTime(
  dateTime1: string,
  dateTime2: string,
  units:
    | DateTimeDurationUnit
    | Temporal.DateTimeUnit
    | Array<DateTimeDurationUnit | Temporal.DateTimeUnit>,
  options?: RoundingOptions<Temporal.DateTimeUnit>,
): number | Record<DateTimeDurationUnit, number> | null {
  // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
  if (!isOptionsArgument(options)) {
    return null;
  }
  const validDateTimes =
    isValidDateTime(dateTime1) && isValidDateTime(dateTime2);
  // Singular names resolve to their plural (Temporal §13.17); record keys are the plural names.
  const resolved = Array.isArray(units)
    ? units.map((unit) => resolveDurationUnit(unit))
    : resolveDurationUnit(units);
  const isSingleUnit = !Array.isArray(resolved);
  const validUnits = isSingleUnit
    ? isValidDateTimeDurationUnit(resolved)
    : resolved.every(isValidDateTimeDurationUnit);
  //

  if (!validDateTimes || !validUnits) {
    return null;
  }

  try {
    // An empty units list names no largest unit, so there is nothing to measure.
    const largestUnit = isSingleUnit
      ? (resolved as DateTimeDurationUnit)
      : getLargestDateTimeDurationUnit(resolved as DateTimeDurationUnit[]);
    if (largestUnit === "") return null;

    const dt1 = Temporal.PlainDateTime.from(dateTime1);
    const dt2 = Temporal.PlainDateTime.from(dateTime2);

    const duration = dt1.until(dt2, {
      largestUnit,
      smallestUnit: options?.smallestUnit,
      roundingIncrement: options?.roundingIncrement,
      roundingMode: options?.roundingMode,
    });
    if (isSingleUnit) {
      return duration[resolved as DateTimeDurationUnit] ?? 0;
    }

    // craft record for units passed
    // An unlisted unit between two listed units is carried into the next smaller listed unit.
    return differenceRecord(dt1, duration, resolved as DateTimeDurationUnit[], {
      add: (from, amount) => from.add(amount),
      until: (from, to, largest) =>
        from.until(to, { largestUnit: largest as Temporal.DateTimeUnit }),
    });
  } catch {
    return null;
  }
}
