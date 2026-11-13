import { plainDateOf } from "./inputChecks";
import { Temporal } from "./temporal";
import { todayDate } from "./todayDate";

/**
 * How a date compares with today in the host's time zone.
 *
 * @param value an ISO `PlainDate` string
 * @returns `-1` before today, `0` today, `1` after today, or `null` for an invalid date or when the host reports no time zone or clock
 *
 * @example compareToToday("2024-03-14") // -1, if today is 2024-03-15
 * @example compareToToday("invalid") // null
 */
export function compareToToday(value: unknown): -1 | 0 | 1 | null {
  const date = plainDateOf(value);
  if (date === null) {
    return null;
  }

  const today = todayDate();
  if (today === null) {
    return null;
  }

  return Temporal.PlainDate.compare(date, today);
}
