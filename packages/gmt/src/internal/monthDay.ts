import type { Temporal } from "./temporal";

/**
 * The ISO reference year of every `Temporal.PlainMonthDay` GMT builds: 1972.
 *
 * Temporal fixes it in the `PlainMonthDay` constructor and ToTemporalMonthDay: "Set
 * _referenceISOYear_ to 1972 (the first ISO 8601 leap year after the epoch)". It is a leap year,
 * so `--02-29` exists in it. GMT uses it to compare and to format, and never prints it.
 */
export const REFERENCE_ISO_YEAR = 1972;

/**
 * The canonical `--MM-DD` string of a month-day: Temporal's `MM-DD` with the `--` of RFC 3339
 * Appendix A (`datespec-mday`) in front. The reference year is never written.
 *
 * @param monthDay an ISO-calendar `PlainMonthDay`
 * @returns the `--MM-DD` string
 *
 * @example monthDayString(Temporal.PlainMonthDay.from("12-25")) // "--12-25"
 */
export function monthDayString(monthDay: Temporal.PlainMonthDay): string {
  return `--${monthDay.toString({ calendarName: "never" })}`;
}
