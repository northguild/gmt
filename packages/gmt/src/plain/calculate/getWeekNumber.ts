import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Calculate the week number based on configurable week start day.
 *
 * - `"monday"` (default) is the ISO 8601 week of the week-year: week 1 is the week containing the
 *   first Thursday, so late-December days can be week 1 of the next year (`"2024-12-31"` → 1).
 *   The result is 1–53.
 * - `"sunday"` numbers weeks within the calendar year, with no week-year rollover: week 1 runs
 *   from 1 January to the first Saturday and each Sunday starts the next week. Late-December days
 *   stay in their own year, so the result is 1–54 (`"2024-12-31"` → 53, `"2000-12-31"` → 54).
 * - Returns null for invalid input, including every shape `isValidDate` rejects: a date-time,
 *   zoned, basic-format, leap-second or `[u-ca=...]`-annotated string.
 * - Compatibility: earlier releases read those shapes loosely (`"2024-03-15T10:00"` → `11`).
 *   Pass the date part alone, or use `Temporal.PlainDate.from(value).weekOfYear`.
 *
 * @param dateStr ISO PlainDate string (e.g. "2024-03-15")
 * @param weekStartsOn optional: "monday" (default) or "sunday"
 * @returns Week number (1-53 for "monday", 1-54 for "sunday"), or null on invalid input
 *
 * @example getWeekNumber("2024-01-01") // 1
 * @example getWeekNumber("2024-01-08") // 2
 * @example getWeekNumber("2024-12-31") // 1
 * @example getWeekNumber("2024-01-01", "sunday") // 1
 * @example getWeekNumber("2024-12-31", "sunday") // 53 (calendar-year weeks, no rollover)
 * @example getWeekNumber("2000-12-31", "sunday") // 54 (1 January 2000 was a Saturday, a one-day week 1)
 * @example getWeekNumber("invalid") // null
 * @example getWeekNumber("2024-03-15T10:00") // null (a date-time, not a PlainDate)
 * @example getWeekNumber("2024-03-15T10:00".slice(0, 10)) // 11 (the date part)
 */
export function getWeekNumber(
  dateStr: string,
  weekStartsOn: "monday" | "sunday" = "monday",
): number | null {
  if (!isValidDate(dateStr)) return null;

  try {
    const date = Temporal.PlainDate.from(dateStr);

    if (weekStartsOn === "monday") {
      const isoWeek = date.weekOfYear;
      return isoWeek ?? null;
    }

    const yearStart = Temporal.PlainDate.from({
      year: date.year,
      month: 1,
      day: 1,
    });

    const firstDayOfWeek = yearStart.dayOfWeek;
    const daysSinceSunday = firstDayOfWeek === 7 ? 0 : firstDayOfWeek;
    const daysSinceJan1 = date.dayOfYear - 1;
    const result = Math.floor((daysSinceJan1 + daysSinceSunday) / 7) + 1;
    return result;
  } catch {
    return null;
  }
}
