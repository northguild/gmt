import { Temporal } from "@js-temporal/polyfill";
import type { DateTimeDurationUnit, RoundingOptions } from "../../types";
import { isValidDateTime, isValidDateTimeDurationUnit } from "../validate";
import { getLargestDateTimeDurationUnit } from "./getLargestDateTimeDurationUnit";

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
 *   array (e.g. `["day", "hour"]` with `smallestUnit: "week"`) — this combination is rejected by
 *   Temporal and returns null, same as other invalid input.
 *
 * @param dateTime1 ISO PlainDateTime string for the start
 * @param dateTime2 ISO PlainDateTime string for the end
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls)
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffDateTime("2024-03-10T12:00:00", "2024-03-15T12:00:00", "day") // 5
 * @example diffDateTime("invalid", "2024-03-15T12:00:00", "day") // null
 */
export function diffDateTime(
  dateTime1: string,
  dateTime2: string,
  units: DateTimeDurationUnit | DateTimeDurationUnit[],
  options?: RoundingOptions<Temporal.DateTimeUnit>,
): number | Record<DateTimeDurationUnit, number> | null {
  const validDateTimes =
    isValidDateTime(dateTime1) && isValidDateTime(dateTime2);
  const isSingleUnit = !Array.isArray(units);
  const validUnits = isSingleUnit
    ? isValidDateTimeDurationUnit(units)
    : units.every(isValidDateTimeDurationUnit);
  //

  if (!validDateTimes || !validUnits) {
    return null;
  }

  try {
    const dt1 = Temporal.PlainDateTime.from(dateTime1);
    const dt2 = Temporal.PlainDateTime.from(dateTime2);

    const duration = dt1.until(dt2, {
      largestUnit: isSingleUnit ? units : getLargestDateTimeDurationUnit(units),
      smallestUnit: options?.smallestUnit,
      roundingIncrement: options?.roundingIncrement,
      roundingMode: options?.roundingMode,
    });
    if (isSingleUnit) {
      return duration[units] ?? 0;
    }

    // craft record for units passed
    return (units as DateTimeDurationUnit[]).reduce(
      (result, unit) => {
        result[unit] = duration[unit] ?? 0;
        return result;
      },
      {} as Record<DateTimeDurationUnit, number>,
    );
  } catch {
    return null;
  }
}
