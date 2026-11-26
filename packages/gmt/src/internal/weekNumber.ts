import type { Temporal } from "./temporal";

/**
 * The week of the week-year a date falls in, 1 to 53.
 *
 * - `"monday"` is the ISO 8601 week.
 * - `"sunday"` is the UTS #35 week of year with Sunday as the first day and a minimal first
 *   week of one day: a week belongs to the week-year of its Saturday, and week 1 is the one whose
 *   Saturday falls in 1 to 7 January. It is counted on the day of the year, so a week ending past
 *   +275760-09-13 still resolves.
 * - Only the ISO calendar has these weeks; any other calendar returns `null`.
 *
 * @param date the date
 * @param weekStartsOn the first day of the week
 * @returns the week number, or `null` for a non-ISO calendar or a date Temporal cannot number
 *
 * @example weekNumberOf(Temporal.PlainDate.from("2024-01-08"), "monday") // 2
 * @example weekNumberOf(Temporal.PlainDate.from("2024-12-31"), "sunday") // 1
 * @example weekNumberOf(Temporal.PlainDate.from("2024-03-15[u-ca=hebrew]"), "monday") // null
 */
export function weekNumberOf(
  date: Temporal.PlainDate,
  weekStartsOn: "monday" | "sunday",
): number | null {
  try {
    if (date.calendarId !== "iso8601") return null;

    if (weekStartsOn === "monday") {
      return date.weekOfYear ?? null;
    }

    const daysToSaturday = 6 - (date.dayOfWeek % 7);
    const saturdayDayOfYear = date.dayOfYear + daysToSaturday;

    if (saturdayDayOfYear > date.daysInYear) return 1;

    return Math.floor((saturdayDayOfYear - 1) / 7) + 1;
  } catch {
    return null;
  }
}
