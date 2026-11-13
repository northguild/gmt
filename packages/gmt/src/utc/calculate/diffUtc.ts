// fallow-ignore-file code-duplication -- cross-family Temporal type clone, by design (rule 5)
import { Temporal } from "../../internal/temporal";
import { addToZoned, zonedUntil } from "../../internal";
import { differenceRecord } from "../../internal/differenceRecord";
import {
  largestDateTimeDurationUnit,
  resolveDurationUnit,
} from "../../internal/resolveDurationUnit";
import { isDateTimeDurationUnitName } from "../../internal/unitNames";
import type { DateTimeDurationUnit, RoundingOptions } from "../../types";
import { utcInstantOf } from "../../internal/utcInstant";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Return the difference between two UTC datetimes measured in the given date-time unit.
 *
 * - Converts both values to a `Temporal.ZonedDateTime` in UTC and uses its `until()`, so calendar
 *   units (days, weeks, months, years) are measured on the UTC wall clock — which has no DST, so
 *   every day is 24 hours — while time units are exact elapsed time.
 *   `Temporal.Instant.until()` is not used: it rejects every calendar `largestUnit`.
 * - Supports single unit or array of units.
 * - Returns null for invalid input.
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
 * - Nanosecond precision: the result is a JavaScript `number`, so it stops being exact once it
 *   passes `Number.MAX_SAFE_INTEGER` — about 104 days in nanoseconds and about 285 years in
 *   microseconds. `diffUtc("2024-01-01T00:00:00Z", "2024-04-15T00:00:00.000000001Z", "nanoseconds")`
 *   returns `9072000000000000` rather than `9072000000000001`. For an exact count use the `bigint` APIs: `spanNs`
 *   in `span/`, or `toNanoseconds` in `precision/`.
 *
 * @param value1 UTC ISO datetime string (start)
 * @param value2 UTC ISO datetime string (end)
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference
 * @param options optional: how the difference is rounded; a non-object value (such as `null`) is invalid
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffUtc("2024-03-10T12:00:00Z", "2024-03-11T12:00:00Z", "hours") // 24
 * @example diffUtc("2024-03-10T12:00:00Z", "2025-04-10T12:00:00Z", ["years", "months"]) // { years: 1, months: 1 }
 * @example diffUtc("invalid", "2024-03-11T12:00:00Z", "hours") // null
 * @example diffUtc("2024-01-01T00:00:00Z", "2025-03-01T00:00:00Z", ["years", "days"]) // { years: 1, days: 59 } (P1Y2M; the 2 months are carried into days)
 */
export function diffUtc(
  value1: string,
  value2: string,
  units:
    | DateTimeDurationUnit
    | Temporal.DateTimeUnit
    | Array<DateTimeDurationUnit | Temporal.DateTimeUnit>,
  options?: RoundingOptions<Temporal.DateTimeUnit>,
): number | Record<DateTimeDurationUnit, number> | null {
  try {
    // Temporal GetOptionsObject: options are an object or omitted; null and primitives are invalid.
    if (!isOptionsArgument(options)) {
      return null;
    }
    const instant1 = utcInstantOf(value1);
    if (instant1 === null) {
      return null;
    }

    const instant2 = utcInstantOf(value2);
    if (instant2 === null) {
      return null;
    }
    // Singular names resolve to their plural (Temporal §13.17); record keys are the plural names.
    const resolved = Array.isArray(units)
      ? units.map((unit) => resolveDurationUnit(unit))
      : resolveDurationUnit(units);
    const isSingleUnit = !Array.isArray(resolved);
    const validUnits = isSingleUnit
      ? isDateTimeDurationUnitName(resolved)
      : resolved.every(isDateTimeDurationUnitName);

    if (!validUnits) {
      return null;
    }

    try {
      // An empty units list names no largest unit, so there is nothing to measure.
      const largestUnit = isSingleUnit
        ? (resolved as DateTimeDurationUnit)
        : largestDateTimeDurationUnit(resolved as DateTimeDurationUnit[]);
      if (largestUnit === "") return null;

      const zdt1 = instant1.toZonedDateTimeISO("UTC");
      const zdt2 = instant2.toZonedDateTimeISO("UTC");

      const duration = zonedUntil(zdt1, zdt2, {
        largestUnit,
        smallestUnit: options?.smallestUnit,
        roundingIncrement: options?.roundingIncrement,
        roundingMode: options?.roundingMode,
      });

      if (isSingleUnit) {
        return duration[resolved as DateTimeDurationUnit] ?? 0;
      }

      // An unlisted unit between two listed units is carried into the next smaller listed unit.
      return differenceRecord(
        zdt1,
        duration,
        resolved as DateTimeDurationUnit[],
        {
          add: (from, amount) => addToZoned(from, amount),
          until: (from, to, largest) =>
            zonedUntil(from, to, {
              largestUnit: largest as Temporal.DateTimeUnit,
            }),
        },
      );
    } catch {
      return null;
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
