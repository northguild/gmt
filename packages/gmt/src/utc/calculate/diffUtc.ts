import { Temporal } from "@js-temporal/polyfill";
import { getLargestDateTimeDurationUnit } from "../../plain/calculate/getLargestDateTimeDurationUnit";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Return the difference between two UTC datetimes measured in the given date-time unit.
 *
 * - Uses Temporal.Instant.until() to calculate the difference.
 * - Supports single unit or array of units.
 * - Returns null for invalid input.
 *
 * @param value1 UTC ISO datetime string (start)
 * @param value2 UTC ISO datetime string (end)
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffUtc("2024-03-10T12:00:00Z", "2024-03-11T12:00:00Z", "hour") // 24
 * @example diffUtc("2024-03-10T12:00:00Z", "2025-04-10T12:00:00Z", ["year", "month"]) // { year: 1, month: 1 }
 * @example diffUtc("invalid", "2024-03-11T12:00:00Z", "hour") // null
 */
export function diffUtc(
  value1: string,
  value2: string,
  units: DateTimeDurationUnit | DateTimeDurationUnit[],
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

    const duration = zdt1.until(zdt2, {
      largestUnit: isSingleUnit ? units : getLargestDateTimeDurationUnit(units),
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
