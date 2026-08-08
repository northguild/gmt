import { Temporal } from "@js-temporal/polyfill";
import type { DateDurationUnit, RoundingOptions } from "../../types";
import { isValidDate, isValidDateDurationUnit } from "../validate";
import { getLargestDateDurationUnit } from "./getLargestDateDurationUnit";

/**
 * Return the difference between two PlainDate values using the provided `unit`.
 *
 * - Returns `null` for invalid inputs (negative diffs are valid).
 * - Uses Temporal.PlainDate.until and extracts the requested unit.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the result,
 * per Temporal's DifferenceOptions — e.g. `{ smallestUnit: "week", roundingMode: "halfExpand" }`
 * rounds the difference to the nearest week before extracting the requested unit.
 * - When `unitArg` is an array, `smallestUnit` must not be coarser than the largest unit in the
 *   array (e.g. `["month", "day"]` with `smallestUnit: "year"`) — this combination is rejected
 *   by Temporal and returns null, same as other invalid input.
 *
 * @param date1 ISO PlainDate string for the start
 * @param date2 ISO PlainDate string for the end
 * @param unitArg DateDurationUnit | DateDurationUnit[] to measure the difference
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls)
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffDate("2024-03-10", "2024-03-15", "day") // 5
 * @example diffDate("invalid", "2024-03-15", "day") // null
 * @example diffDate("2024-01-01", "2024-01-16", "week", { smallestUnit: "week", roundingMode: "halfExpand" }) // 2
 */
export function diffDate(
  date1: string,
  date2: string,
  unitArg: DateDurationUnit | DateDurationUnit[],
  options?: RoundingOptions<Temporal.DateUnit>,
): number | Record<DateDurationUnit, number> | null {
  const validDates = isValidDate(date1) && isValidDate(date2);
  const isSingleUnit = !Array.isArray(unitArg);
  const validUnits = isSingleUnit
    ? isValidDateDurationUnit(unitArg)
    : (unitArg as DateDurationUnit[]).every(isValidDateDurationUnit);

  if (!validDates || !validUnits) {
    return null;
  }

  try {
    const d1 = Temporal.PlainDate.from(date1);
    const d2 = Temporal.PlainDate.from(date2);

    const duration = d1.until(d2, {
      largestUnit: isSingleUnit
        ? unitArg
        : getLargestDateDurationUnit(unitArg as DateDurationUnit[]),
      smallestUnit: options?.smallestUnit,
      roundingIncrement: options?.roundingIncrement,
      roundingMode: options?.roundingMode,
    });

    // craft record for units passed
    if (isSingleUnit) {
      return duration[unitArg as DateDurationUnit] ?? 0;
    }

    return (unitArg as DateDurationUnit[]).reduce(
      (result, unit) => {
        result[unit] = duration[unit] ?? 0;
        return result;
      },
      {} as Record<DateDurationUnit, number>,
    );
  } catch {
    return null;
  }
}
