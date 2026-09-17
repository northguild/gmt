import { Temporal } from "@js-temporal/polyfill";
import { zonedUntil } from "../../internal";
import { getLargestDateTimeDurationUnit } from "../../plain/calculate/getLargestDateTimeDurationUnit";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit, RoundingOptions } from "../../types";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Return the difference between two UTC datetimes measured in the given date-time unit.
 *
 * - Uses Temporal.Instant.until() to calculate the difference.
 * - Supports single unit or array of units.
 * - Returns null for invalid input.
 *
 * `smallestUnit`, `roundingIncrement`, and `roundingMode` control optional rounding of the result,
 * per Temporal's DifferenceOptions — e.g. `{ smallestUnit: "hour", roundingMode: "halfExpand" }`
 * rounds the difference to the nearest hour before extracting the requested unit.
 * - When `units` is an array, `smallestUnit` must not be coarser than the largest unit in the
 *   array (e.g. `["days", "hours"]` with `smallestUnit: "week"`) — this combination is rejected by
 *   Temporal and returns null, same as other invalid input.
 * - With an array of units, the largest listed unit is Temporal's `largestUnit` and only the listed
 *   units are returned. Amounts in units between the listed ones are computed and not returned —
 *   they are not carried into a smaller listed unit. For example, `["years", "days"]` over
 *   1 year 59 days returns `{ years: 1, days: 0 }` (the 2 months are dropped).
 *
 * @param value1 UTC ISO datetime string (start)
 * @param value2 UTC ISO datetime string (end)
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference
 * @param options optional: smallestUnit, roundingIncrement, roundingMode (Temporal.DifferenceOptions rounding controls)
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffUtc("2024-03-10T12:00:00Z", "2024-03-11T12:00:00Z", "hours") // 24
 * @example diffUtc("2024-03-10T12:00:00Z", "2025-04-10T12:00:00Z", ["years", "months"]) // { years: 1, months: 1 }
 * @example diffUtc("invalid", "2024-03-11T12:00:00Z", "hours") // null
 * @example diffUtc("2024-01-01T00:00:00Z", "2025-03-01T00:00:00Z", ["years", "days"]) // { years: 1, days: 0 } (P1Y2M; the months are not returned)
 */
export function diffUtc(
  value1: string,
  value2: string,
  units: DateTimeDurationUnit | DateTimeDurationUnit[],
  options?: RoundingOptions<Temporal.DateTimeUnit>,
): number | Record<DateTimeDurationUnit, number> | null {
  const validUtc1 = isValidUtc(value1);
  const validUtc2 = isValidUtc(value2);
  const isSingleUnit = !Array.isArray(units);
  const validUnits = isSingleUnit
    ? isValidDateTimeDurationUnit(units)
    : units.every(isValidDateTimeDurationUnit);

  if (!validUtc1 || !validUtc2 || !validUnits) {
    return null;
  }

  try {
    const instant1 = Temporal.Instant.from(value1);
    const instant2 = Temporal.Instant.from(value2);

    const zdt1 = instant1.toZonedDateTimeISO("UTC");
    const zdt2 = instant2.toZonedDateTimeISO("UTC");

    const duration = zonedUntil(zdt1, zdt2, {
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
