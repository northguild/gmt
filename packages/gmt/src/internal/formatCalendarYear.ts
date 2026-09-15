/**
 * The year digits of GMT's calendar-annotated date string: four digits (zero-padded, up to six
 * when needed) for a year >= 0, and for a negative year a minus sign plus six digits, the form
 * Temporal's `PadISOYear` writes. Matches the year group of `regex/calendar-date.ts`.
 *
 * @example formatCalendarYear(5785) // "5785"
 * @example formatCalendarYear(0) // "0000"
 * @example formatCalendarYear(279517) // "279517"
 * @example formatCalendarYear(-911) // "-000911"
 */
export function formatCalendarYear(year: number): string {
  return year < 0
    ? `-${String(-year).padStart(6, "0")}`
    : String(year).padStart(4, "0");
}
