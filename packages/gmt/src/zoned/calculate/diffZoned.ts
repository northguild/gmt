import { Temporal } from "@js-temporal/polyfill";
import { getLargestDateTimeDurationUnit } from "../../plain/calculate/getLargestDateTimeDurationUnit";
import { isValidDateTimeDurationUnit } from "../../plain/validate";
import type { DateTimeDurationUnit } from "../../types";
import { isValidZonedDateTime } from "../validate";

/**
 * Return the difference between two zoned datetimes measured in the given
 * date-time `unit` (year|month|day|hour|minute|...).
 *
 * - Uses Temporal.ZonedDateTime.until with `largestUnit` and extracts the
 *   requested unit from the resulting Duration.
 * - Returns `null` for invalid inputs (no sentinel since negative diffs are valid).
 *
 * @param value1 zoned ISO 8601 datetime string (start)
 * @param value2 zoned ISO 8601 datetime string (end)
 * @param units DateTimeDurationUnit | DateTimeDurationUnit[] to measure the difference (e.g. "hours" | ["years", "months", "hours"])
 * @returns numeric difference in the requested unit, or null on invalid input
 */
export function diffZoned(
  value1: string,
  value2: string,
  units: DateTimeDurationUnit | DateTimeDurationUnit[],
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
