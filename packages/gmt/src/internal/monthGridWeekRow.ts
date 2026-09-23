import type { Temporal } from "@js-temporal/polyfill";

/**
 * Return the 1-based calendar-grid week row that `dayInMonth` falls on for
 * `firstOfMonth`'s month, given `firstDay` (locale first day of week,
 * 1 = Monday .. 7 = Sunday).
 *
 * Shared by `getWeekOfMonth` (row for the date itself) and
 * `getWeeksInMonth` (row for the month's last day, i.e. the row count).
 * Week 1 is the row containing the 1st of the month, even when that row
 * is a partial week (date-fns's `getWeekOfMonth` convention).
 *
 * Only the weekday of the 1st is read, so callers may pass `{ dayOfWeek }` without building a
 * date that could lie before the representable range (April 1 of -271821).
 */
export function monthGridWeekRow(
  firstOfMonth: Pick<Temporal.PlainDate, "dayOfWeek">,
  firstDay: number,
  dayInMonth: number,
): number {
  const leadingOffset = (firstOfMonth.dayOfWeek - firstDay + 7) % 7;
  return Math.floor((leadingOffset + dayInMonth - 1) / 7) + 1;
}
