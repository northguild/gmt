import type { Temporal } from "./temporal";

/**
 * The canonical `YYYY-MM` string of a year-month (`±YYYYYY-MM` outside 0000-9999): the form every
 * year-month function writes. Temporal's reference day (1) is never written.
 *
 * @param yearMonth an ISO-calendar `PlainYearMonth`
 * @returns the year-month string
 *
 * @example yearMonthString(Temporal.PlainYearMonth.from("2026-10")) // "2026-10"
 */
export function yearMonthString(yearMonth: Temporal.PlainYearMonth): string {
  return yearMonth.toString({ calendarName: "never" });
}
