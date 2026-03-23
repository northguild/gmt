import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime, isValidDateTimeUnit } from "../validate";

/**
 * Return the difference between two PlainDateTime values in the requested
 * largest unit (year|month|day|hour|...).
 *
 * - Returns `null` when inputs or unit are invalid.
 * - Uses Temporal.PlainDateTime.until with `largestUnit` and extracts the
 *   requested unit value from the resulting Duration.
 *
 * @param dateTime1 ISO PlainDateTime string for the start
 * @param dateTime2 ISO PlainDateTime string for the end
 * @param unit Temporal.DateTimeUnit to measure the difference
 * @returns numeric difference in the requested unit, or null on invalid input
 */
export function diffDateTime(
  dateTime1: string,
  dateTime2: string,
  unit: Temporal.DateTimeUnit,
): number | null {
  const validDateTimes =
    isValidDateTime(dateTime1) && isValidDateTime(dateTime2);
  const validUnit = isValidDateTimeUnit(unit);

  if (!validDateTimes || !validUnit) {
    return null;
  }

  const dt1 = Temporal.PlainDateTime.from(dateTime1);
  const dt2 = Temporal.PlainDateTime.from(dateTime2);

  const duration = dt1.until(dt2, { largestUnit: unit });

  return duration[`${unit}s`] ?? null;
}
