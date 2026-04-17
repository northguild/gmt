import { Temporal } from "@js-temporal/polyfill";
import type { TimeDurationUnit } from "../../types";
import { isValidTime, isValidTimeDurationUnit } from "../validate";
import { getLargestTimeDurationUnit } from "./getLargestTimeDurationUnit";

/**
 * Return the difference between two PlainTime values in the requested unit.
 *
 * - Returns `null` for invalid inputs.
 * - Uses Temporal.PlainTime.until with `largestUnit` and extracts the requested unit.
 *
 * @param time1 ISO PlainTime string for the start
 * @param time2 ISO PlainTime string for the end
 * @param units TimeDurationUnit | TimeDurationUnit[] to measure the difference
 * @returns numeric difference in the requested unit, or null on invalid input
 *
 * @example diffTime("12:00:00", "14:30:00", "hour") // 2
 * @example diffTime("invalid", "14:30:00", "hour") // null
 */
export function diffTime(
  time1: string,
  time2: string,
  units: TimeDurationUnit | TimeDurationUnit[],
): number | Record<TimeDurationUnit, number> | null {
  const validTimes = isValidTime(time1) && isValidTime(time2);
  const isSingleUnit = !Array.isArray(units);
  const validUnits = isSingleUnit
    ? isValidTimeDurationUnit(units)
    : units.every(isValidTimeDurationUnit);

  if (!validTimes || !validUnits) {
    return null;
  }

  try {
    const t1 = Temporal.PlainTime.from(time1);
    const t2 = Temporal.PlainTime.from(time2);

    const duration = t1.until(t2, {
      largestUnit: isSingleUnit ? units : getLargestTimeDurationUnit(units),
    });

    // craft record for units passed
    if (isSingleUnit) {
      return duration[units] ?? 0;
    }

    return (units as TimeDurationUnit[]).reduce(
      (result, unit) => {
        result[unit] = duration[unit] ?? 0;
        return result;
      },
      {} as Record<TimeDurationUnit, number>,
    );
  } catch {
    return null;
  }
}
