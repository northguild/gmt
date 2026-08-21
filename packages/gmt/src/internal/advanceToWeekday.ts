import type { Temporal } from "@js-temporal/polyfill";

/**
 * Return the PlainDate for the next/previous occurrence of `dayOfWeek` relative to `date`.
 *
 * @param date starting PlainDate
 * @param dayOfWeek target ISO day of week (1-7)
 * @param direction 1 to search forward (next), -1 to search backward (previous)
 * @param inclusive when `date` already falls on `dayOfWeek`, return it as-is instead of
 *   advancing a full week
 * @returns PlainDate for the resolved weekday
 */
export function advanceToWeekday(
  date: Temporal.PlainDate,
  dayOfWeek: number,
  direction: 1 | -1,
  inclusive: boolean,
): Temporal.PlainDate {
  const current = date.dayOfWeek;

  if (current === dayOfWeek) {
    if (inclusive) return date;
    return date.add({ days: 7 * direction });
  }

  // Distance to the target weekday walking in `direction`, always 1-6 days since
  // current !== dayOfWeek here.
  const diff =
    direction === 1
      ? (dayOfWeek - current + 7) % 7
      : (current - dayOfWeek + 7) % 7;

  return date.add({ days: diff * direction });
}
