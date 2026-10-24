import type { CronExpression } from "../types/cron";
import {
  epochDayOf,
  isoFieldsOf,
  isoWeekdayOf,
  MAX_EPOCH_DAY,
} from "./epochDay";

/**
 * The Gregorian calendar repeats every 400 years, 400 × 365 + 97 = 146,097 days (ISO 8601-1:2019
 * leap-year rule). That is 7 × 20,871, so the weekday repeats with it: a scan of this many days
 * that finds no match proves there is none.
 */
const GREGORIAN_CYCLE_DAYS = 146_097;

/**
 * Whether a day matches the day fields of a cron expression.
 *
 * The month always has to match. Day of month and day of week are ORed only when both are
 * restricted (neither is `*`); otherwise both have to match, and a `*` field matches everything.
 * This is crontab(5) NOTES ("If both fields are restricted (i.e., do not contain the "*"
 * character)... either field matches") and cronie `cron.c` `find_jobs`. POSIX's own wording also
 * ORs when the month is restricted; no shipped cron follows that, and neither does GMT.
 *
 * @param e a checked cron expression
 * @param epochDay days since 1970-01-01
 * @returns whether the expression runs on that day
 *
 * @example cronDayMatches(parseCronExpression("30 4 1,15 * 5"), 19_790) // true (2024-03-08 is a Friday)
 */
export function cronDayMatches(e: CronExpression, epochDay: number): boolean {
  const [, month, dayOfMonth] = isoFieldsOf(epochDay);

  if (!e.month.values.includes(month)) {
    return false;
  }

  const monthDayMatches = e.dayOfMonth.values.includes(dayOfMonth);
  const weekdayMatches = e.dayOfWeek.values.includes(isoWeekdayOf(epochDay));

  return e.dayOfMonth.star || e.dayOfWeek.star
    ? monthDayMatches && weekdayMatches
    : monthDayMatches || weekdayMatches;
}

/**
 * The first day, from `fromDay` through `lastDay`, that an expression matches, and the steps the
 * scan took.
 *
 * Loop bound: each step either tests one day or, outside the month field's values, jumps to the
 * first day of the next listed month, so the loop takes at most one step per day of the range
 * and never more than 146,097 (one Gregorian cycle, also a whole number of weeks, so a scan of
 * that many days without a match proves there is none). The range ends at `lastDay` and at
 * `MAX_EPOCH_DAY`, the last supported day. A jump over unlisted months is one step, so `steps` is
 * the work done, not the distance covered.
 *
 * @param e a checked cron expression
 * @param fromDay the first epoch day to look at
 * @param lastDay the last epoch day to look at, or omitted for the end of one Gregorian cycle
 * @returns `day` the epoch day, or null when there is no match in that range: no match in 146,097
 * days, none through `lastDay`, or the scan passed the last supported epoch day; and `steps`, the
 * loop steps taken
 *
 * @example scanCronDays(parseCronExpression("0 0 1 6 *"), 19_723) // { day: 19_875, steps: 2 } (2024-06-01: one jump, one test)
 */
export function scanCronDays(
  e: CronExpression,
  fromDay: number,
  lastDay: number = Number.POSITIVE_INFINITY,
): { day: number | null; steps: number } {
  const last = Math.min(
    fromDay + GREGORIAN_CYCLE_DAYS - 1,
    MAX_EPOCH_DAY,
    lastDay,
  );
  let steps = 0;

  for (let day = fromDay; day <= last; day += 1) {
    steps += 1;
    const [year, month] = isoFieldsOf(day);

    if (!e.month.values.includes(month)) {
      // Jump to the first day of the next listed month (the next year when none is left in this one).
      const next = e.month.values.find((value) => value > month);

      day =
        (next === undefined
          ? epochDayOf(year + 1, e.month.values[0]!, 1)
          : epochDayOf(year, next, 1)) - 1;
      continue;
    }

    if (cronDayMatches(e, day)) {
      return { day, steps };
    }
  }

  return { day: null, steps };
}

/**
 * The first day, from `fromDay` through `lastDay`, that an expression matches.
 *
 * Loop bound: that of {@link scanCronDays}, at most 146,097 steps.
 *
 * @param e a checked cron expression
 * @param fromDay the first epoch day to look at
 * @param lastDay the last epoch day to look at, or omitted for the end of one Gregorian cycle
 * @returns the epoch day, or null when there is no match in that range: no match in 146,097 days,
 * none through `lastDay`, or the scan passed the last supported epoch day
 *
 * @example nextCronDay(parseCronExpression("0 0 29 2 *"), 19_783) // 21_243 (2028-02-29)
 * @example nextCronDay(parseCronExpression("0 0 29 2 *"), 19_783, 21_242) // null (stops before 2028-02-29)
 */
export function nextCronDay(
  e: CronExpression,
  fromDay: number,
  lastDay: number = Number.POSITIVE_INFINITY,
): number | null {
  return scanCronDays(e, fromDay, lastDay).day;
}
