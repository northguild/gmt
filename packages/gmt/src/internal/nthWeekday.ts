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
 * Epoch day of the `n`-th ISO `weekday` in the closed day range `[first, last]` (epoch days):
 * `n > 0` counts from `first`, `n < 0` from `last`. `null` when that occurrence lies outside the
 * range. The range may reach past Temporal's date range and the count includes those days: a
 * recurrence period counts its whole span before it drops the dates a PlainDate cannot hold.
 * `n` is a nonzero integer. Closed form: the offset to the first (or last) matching weekday plus
 * `7 x (|n| - 1)`, no loop.
 */
export function nthWeekdayWithin(
  first: number,
  last: number,
  weekday: number,
  n: number,
): number | null {
  const day =
    n > 0
      ? first +
        ((weekday - isoWeekdayOf(first) + ISO_WEEKDAYS) % ISO_WEEKDAYS) +
        ISO_WEEKDAYS * (n - 1)
      : last -
        ((isoWeekdayOf(last) - weekday + ISO_WEEKDAYS) % ISO_WEEKDAYS) -
        ISO_WEEKDAYS * (-n - 1);

  // A NaN from an overflowed year fails both comparisons, so it gives `null` too.
  return day >= first && day <= last ? day : null;
}

/**
 * Epoch day of the `n`-th ISO `weekday` in the closed day range `[first, last]` (epoch days), or
 * `null` when that occurrence lies outside the range or outside Temporal's date range. See
 * {@link nthWeekdayWithin} for the count.
 */
export function nthWeekdayInRange(
  first: number,
  last: number,
  weekday: number,
  n: number,
): number | null {
  const day = nthWeekdayWithin(first, last, weekday, n);

  return day !== null && day >= MIN_EPOCH_DAY && day <= MAX_EPOCH_DAY
    ? day
    : null;
}

/**
 * Epoch day of the `n`-th ISO weekday of an ISO month, or `null` when that occurrence does not
 * exist or lies outside Temporal's date range. `n` is an already-checked integer in
 * `-5..-1` or `1..5`. Counts from the month's first day (`n > 0`) or last day (`n < 0`).
 */
export function nthWeekdayEpochDay(
  year: number,
  month: number,
  weekday: number,
  n: number,
): number | null {
  const next =
    month === 12 ? epochDayOf(year + 1, 1, 1) : epochDayOf(year, month + 1, 1);

  return nthWeekdayInRange(epochDayOf(year, month, 1), next - 1, weekday, n);
}
