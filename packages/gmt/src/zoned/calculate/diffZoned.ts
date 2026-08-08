import { Temporal } from "@js-temporal/polyfill";
import { getLargestDateTimeDurationUnit } from "../../plain/calculate/getLargestDateTimeDurationUnit";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, RoundingOptions } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the difference between two zoned datetimes measured in the given date-time unit.
 *
 * - Uses Temporal.ZonedDateTime.until to calculate difference.
 * - Converts both to UTC for consistent calculation.
 * - Supports single unit or array of units.
 * - Returns null for invalid input.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the result,
 * per Temporal's DifferenceOptions — e.g. `{ smallestUnit: "hour", roundingMode: "halfExpand" }`
 * rounds the difference to the nearest hour before extracting the requested unit.
 * - When `units` is an array, `smallestUnit` must not be coarser than the largest unit in the
 *   array (e.g. `["day", "hour"]` with `smallestUnit: "week"`) — this combination is rejected by
 *   Temporal and returns null, same as other invalid input.
 *
 * @param value1 zoned ISO 8601 datetime string (start)
 * @param value2 zoned ISO 8601 datetime string (end)
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls)
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffZoned("2024-02-28T14:30:00+00:00[UTC]", "2024-03-01T15:30:00+00:00[UTC]", "days") // 2
 * @example diffZoned("invalid", "2024-03-01T15:30:00+00:00[UTC]", "days") // null
 */
export function diffZoned(
  value1: string,
  value2: string,
  units: DateTimeDurationUnit | DateTimeDurationUnit[],
  options?: RoundingOptions<Temporal.DateTimeUnit>,
): number | Record<DateTimeDurationUnit, number> | null {
  const validZonedDateTimes =
    isValidZonedDateTime(value1) && isValidZonedDateTime(value2);
  const isSingleUnit = !Array.isArray(units);
  const validUnits = isSingleUnit
    ? isValidDateTimeDurationUnit(units)
    : units.every(isValidDateTimeDurationUnit);

  if (!validZonedDateTimes || !validUnits) {
    return null;
  }

  try {
    const normalizedZdt1 =
      Temporal.ZonedDateTime.from(value1).withTimeZone("UTC");
    const normalizedZdt2 =
      Temporal.ZonedDateTime.from(value2).withTimeZone("UTC");

    const duration = normalizedZdt1.until(normalizedZdt2, {
      largestUnit: isSingleUnit ? units : getLargestDateTimeDurationUnit(units),
      smallestUnit: options?.smallestUnit,
      roundingIncrement: options?.roundingIncrement,
      roundingMode: options?.roundingMode,
    });

    if (isSingleUnit) {
      return duration[units] ?? 0;
    }

    return units.reduce(
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
