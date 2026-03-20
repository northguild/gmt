import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime, isValidDateTimeUnit } from "../validate";

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
