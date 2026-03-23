import { Temporal } from "@js-temporal/polyfill";
import { isValidTime, isValidTimeUnit } from "../validate";

/**
 * Return the difference between two PlainTime values in the requested unit.
 *
 * - Returns `null` if inputs or unit are invalid.
 * - Uses Temporal.PlainTime.until with `largestUnit` and extracts the
 *   requested unit value from the resulting Duration.
 *
 * @param time1 ISO PlainTime string for the start
 * @param time2 ISO PlainTime string for the end
 * @param unit Temporal.TimeUnit to measure the difference
 * @returns numeric difference in the requested unit, or null on invalid input
 */
export function diffTime(
  time1: string,
  time2: string,
  unit: Temporal.TimeUnit,
): number | null {
  const validTimes = isValidTime(time1) && isValidTime(time2);
  const validUnit = isValidTimeUnit(unit);

  if (!validTimes || !validUnit) {
    return null;
  }

  const t1 = Temporal.PlainTime.from(time1);
  const t2 = Temporal.PlainTime.from(time2);

  const duration = t1.until(t2, { largestUnit: unit });

  return duration[`${unit}s`] ?? null;
}
