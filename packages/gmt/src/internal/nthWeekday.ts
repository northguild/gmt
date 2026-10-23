import type { WeekdayOrdinal } from "../types";
import {
  ISO_WEEKDAYS,
  MAX_EPOCH_DAY,
  MIN_EPOCH_DAY,
  epochDayOf,
  isoWeekdayOf,
} from "./epochDay";

const ORDINALS: ReadonlySet<unknown> = new Set([
  1,
  2,
  3,
  4,
  5,
  -1,
  -2,
  -3,
  -4,
  -5,
  "last",
]);

/** True for `1..5`, `-1..-5` and `"last"`: the ordinals RFC 5545 §3.3.10 allows in a monthly `BYDAY`, plus the `"last"` alias. */
export function isWeekdayOrdinal(value: unknown): value is WeekdayOrdinal {
  return ORDINALS.has(value);
}

/** The signed integer an ordinal stands for: `"last"` is `-1` (GMT's readable alias for the RFC 5545 ordinal). */
export function ordinalNumber(n: WeekdayOrdinal): number {
  return n === "last" ? -1 : n;
}

/**
 * Epoch day of the `n`-th ISO weekday of an ISO month, or `null` when that occurrence does not
 * exist or lies outside Temporal's date range. `n` is an already-checked integer in
 * `-5..-1` or `1..5`. Closed form: counts from the month's first day (`n > 0`) or last day
 * (`n < 0`) in steps of 7 days, no loop.
 */
export function nthWeekdayEpochDay(
  year: number,
  month: number,
  weekday: number,
  n: number,
): number | null {
  const first = epochDayOf(year, month, 1);
  const next =
    month === 12 ? epochDayOf(year + 1, 1, 1) : epochDayOf(year, month + 1, 1);
  let day: number;

  if (n > 0) {
    day =
      first +
      ((weekday - isoWeekdayOf(first) + ISO_WEEKDAYS) % ISO_WEEKDAYS) +
      ISO_WEEKDAYS * (n - 1);
  } else {
    const last = next - 1;
    day =
      last -
      ((isoWeekdayOf(last) - weekday + ISO_WEEKDAYS) % ISO_WEEKDAYS) -
      ISO_WEEKDAYS * (-n - 1);
  }

  // Written as a negated conjunction so a NaN from an overflowed year fails it too.
  if (!(day >= MIN_EPOCH_DAY && day <= MAX_EPOCH_DAY)) {
    return null;
  }
  if (day < first || day >= next) {
    return null;
  }

  return day;
}
