import { Temporal } from "@js-temporal/polyfill";

/**
 * Return an array of ISO PlainDate strings for every day within the given
 * year-month (e.g. "2024-02").
 *
 * - Validates the `month` input using Temporal.PlainYearMonth.
 * - Returns an empty array for invalid input.
 *
 * @param month ISO PlainYearMonth string (YYYY-MM)
 * @returns array of ISO PlainDate strings for each day in the month
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
