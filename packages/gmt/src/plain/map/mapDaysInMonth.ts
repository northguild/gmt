import { Temporal } from "@js-temporal/polyfill";

/**
 * Return an array of ISO PlainDate strings for every day in the given year-month.
 *
 * - Generates array of dates for the specified month.
 * - Validates input matches the year-month format exactly.
 * - Returns [] for invalid input.
 *
 * @param month ISO PlainYearMonth string (YYYY-MM)
 * @returns array of ISO PlainDate strings for each day in the month
 *
 * @example mapDaysInMonth("2024-02") // ["2024-02-01", "2024-02-02", ..., "2024-02-29"]
 * @example mapDaysInMonth("2024-04") // ["2024-04-01", "2024-04-02", ..., "2024-04-30"]
 * @example mapDaysInMonth("invalid") // []
 */
export function mapDaysInMonth(month: string): string[] {
  try {
    const yearMonth = Temporal.PlainYearMonth.from(month);

    if (yearMonth.toString() !== month) {
      return [];
    }

    const daysInMonth = yearMonth.daysInMonth;

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = (index + 1).toString().padStart(2, "0");
      return `${yearMonth.toString()}-${day}`;
    });
  } catch {
    return [];
  }
}
