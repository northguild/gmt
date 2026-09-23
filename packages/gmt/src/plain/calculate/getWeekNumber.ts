import { Temporal } from "@js-temporal/polyfill";

import { isValidDate } from "../validate";

/**
 * Calculate the week number based on configurable week start day.
 *
 * - `"monday"` (default) is the ISO 8601 week of the week-year: week 1 is the week containing the
 *   first Thursday, so late-December days can be week 1 of the next year (`"2024-12-31"` → 1).
 *   The result is 1–53.
 * - `"sunday"` is the UTS #35 (Part 4, Week Data) week of the week-year with a Sunday first day
 *   and minimal days 1: week 1 is the Sunday-first week containing 1 January, so the last days of
 *   December before a mid-week 1 January are week 1 of the next year (`"2024-12-31"` → 1,
 *   `"2000-12-31"` → 1). The result is 1–53.
 * - `weekStartsOn` other than `"monday"` or `"sunday"` returns null; `undefined` is the default.
 * - Returns null for invalid input, including every shape `isValidDate` rejects: a date-time,
 *   zoned, basic-format or leap-second string, or a non-ISO calendar annotation. The annotations
 *   Temporal ignores are accepted (`"2024-06-15[u-ca=iso8601]"` → 24).
 * - Compatibility: earlier releases read those shapes loosely (`"2024-03-15T10:00"` → `11`).
 *   Pass the date part alone, or use `Temporal.PlainDate.from(value).weekOfYear`.
 * - **Compatibility:** before 1.16.0 `"sunday"` counted weeks within the calendar year with no
 *   week-year rollover, so late-December days could be week 53 or 54.
 *
 * @param dateStr ISO PlainDate string (e.g. "2024-03-15")
 * @param weekStartsOn optional: "monday" (default) or "sunday"
 * @returns Week number (1-53), or null on invalid input
 *
 * @example getWeekNumber("2024-01-01") // 1
 * @example getWeekNumber("2024-01-08") // 2
 * @example getWeekNumber("2024-12-31") // 1
 * @example getWeekNumber("2024-01-01", "sunday") // 1
 * @example getWeekNumber("2024-12-28", "sunday") // 52
 * @example getWeekNumber("2024-12-31", "sunday") // 1 (its Sunday-first week holds 1 January 2025)
 * @example getWeekNumber("2000-12-30", "sunday") // 53
 * @example getWeekNumber("2024-01-01", "tuesday" as never) // null (invalid weekStartsOn)
 * @example getWeekNumber("invalid") // null
 * @example getWeekNumber("2024-03-15T10:00") // null (a date-time, not a PlainDate)
 * @example getWeekNumber("2024-03-15T10:00".slice(0, 10)) // 11 (the date part)
 */
export function getWeekNumber(
  dateStr: string,
  weekStartsOn: "monday" | "sunday" = "monday",
): number | null {
  if (
    !isValidDate(dateStr) ||
    (weekStartsOn !== "monday" && weekStartsOn !== "sunday")
  )
    return null;

  try {
    const date = Temporal.PlainDate.from(dateStr);

    if (weekStartsOn === "monday") {
      const isoWeek = date.weekOfYear;
      return isoWeek ?? null;
    }

    // UTS #35 week of year, first day Sunday, minimal days 1: a week belongs to the week-year of
    // its Saturday, and week 1 is the one whose Saturday falls in 1–7 January. Counted on day of
    // year so a week ending past +275760-09-13 still resolves.
    const daysToSaturday = 6 - (date.dayOfWeek % 7);
    const saturdayDayOfYear = date.dayOfYear + daysToSaturday;

    if (saturdayDayOfYear > date.daysInYear) return 1;

    return Math.floor((saturdayDayOfYear - 1) / 7) + 1;
  } catch {
    return null;
  }
}
