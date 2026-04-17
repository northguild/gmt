import { Temporal } from "@js-temporal/polyfill";

/**
 * Calculate the week number based on configurable week start day.
 *
 * - ISO (monday): Week 1 is the week containing the first Thursday (has at least 4 days in the year)
 * - US (sunday): Week 1 is the week containing Jan 1 (first week has at least 1 day)
 *
 * @param dateStr ISO PlainDate string (e.g. "2024-03-15")
 * @param weekStartsOn optional: "monday" (default) or "sunday"
 * @returns Week number (1-53), or null on invalid input
 *
 * @example getWeekNumber("2024-01-01") // 1
 * @example getWeekNumber("2024-01-08") // 2
 * @example getWeekNumber("2024-12-31") // 1
 * @example getWeekNumber("2024-01-01", "sunday") // 1
 * @example getWeekNumber("invalid") // null
 */
export function getWeekNumber(
  dateStr: string,
  weekStartsOn: "monday" | "sunday" = "monday",
): number | null {
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
