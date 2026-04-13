import { Temporal } from "@js-temporal/polyfill";
import type { DateTimeDurationUnit } from "../../types";
import { isValidDateTime, isValidDateTimeDurationUnit } from "../validate";
import { getLargestDateTimeDurationUnit } from "./getLargestDateTimeDurationUnit";

/**
 * Return the difference between two PlainDateTime values in the requested
 * largest unit (year|month|day|hour|...).
 *
 * - Returns `null` for invalid inputs (no sentinel since negative diffs are valid).
 * - Uses Temporal.PlainDateTime.until with `largestUnit` and extracts the
 *   requested unit value from the resulting Duration.
 *
 * @param dateTime1 ISO PlainDateTime string for the start
 * @param dateTime2 ISO PlainDateTime string for the end
 * @param units DateTimeDurationUnit|DateTimeDurationUnit[] to measure the difference (e.g. ["years", "months", "hours"])
 * @example diffDateTime("2024-03-10T12:00:00", "2024-03-15T12:00:00", "day") // 5
 * @example diffDateTime("2024-03-10T12:00:00", "2025-04-10T15:30:00", ["year", "month", "hour"]) // { year: 1, month: 1, hour: 3 }
 * @returns numeric difference in the requested unit, or null on invalid input
 */
export function diffDateTime(
  dateTime1: string,
  dateTime2: string,
  units: DateTimeDurationUnit | DateTimeDurationUnit[],
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
