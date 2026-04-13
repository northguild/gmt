import { Temporal } from "@js-temporal/polyfill";
import { getLargestDateTimeDurationUnit } from "../../plain/calculate/getLargestDateTimeDurationUnit";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";
import { isValidUtc } from "../validate/isValidUtc";

/**
 * Return the difference between two UTC datetimes measured in the given
 * date-time `unit`.
 *
 * - Returns `null` for invalid inputs (no sentinel since negative diffs are valid).
 *
 * @param value1 UTC ISO datetime string (start)
 * @param value2 UTC ISO datetime string (end)
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference (e.g. "hours" | ["years", "months", "hours"])
 * @returns numeric difference in the requested unit, or null on invalid input
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
