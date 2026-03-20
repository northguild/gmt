import { Temporal } from "@js-temporal/polyfill";
import { isValidTime, isValidTimeUnit } from "../validate";

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
