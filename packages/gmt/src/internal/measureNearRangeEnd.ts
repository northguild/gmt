/**
 * Days in one 400-year proleptic Gregorian cycle (97 leap years: 400 × 365 + 97). The cycle is a
 * whole number of weeks (146,097 = 7 × 20,871), so shifting a date by it keeps its month lengths,
 * leap years and weekday (ISO 8601-1:2019 §4.3.4 and §4.3.2.1).
 */
const GREGORIAN_CYCLE_DAYS = 146_097;

/** ISO year the proxy is shifted down to or just above: clear of every era start (reiwa, 2019). */
const PROXY_FLOOR_YEAR = 2400;

/**
 * Calendars whose months, leap years and year starts follow the proleptic Gregorian calendar
 * (CLDR calendar data: gregory, buddhist and roc only offset the year number; japanese does too
 * outside its era-start years, and the proxy never lands on one).
 */
const GREGORIAN_STRUCTURED_CALENDARS: ReadonlySet<string> = new Set([
  "iso8601",
  "gregory",
  "buddhist",
  "roc",
  "japanese",
]);

interface ShiftableByDays<T> {
  readonly calendarId: string;
  withCalendar(calendar: "iso8601"): { readonly year: number };
  subtract(duration: { days: number }): T;
}

/**
 * Run `measure` on `source`, and when it throws because a boundary it builds lies after the last
 * representable date, run it again on `source` shifted back by whole 400-year Gregorian cycles.
 *
 * - Use only for a quantity the cycle leaves unchanged: a length in days (or time) between
 *   boundaries of years, months or weeks. Never for a returned date.
 * - Applies to Gregorian-structured calendars only; any other calendar rethrows the error.
 * - A source already below `PROXY_FLOOR_YEAR` rethrows: its failure is not a max-edge one.
 *
 * @param source date or date-time whose surroundings are measured
 * @param measure computes the quantity from a date in the same position of its cycle
 * @returns the quantity, identical for `source` and its shifted proxy
 *
 * @example measureNearRangeEnd(Temporal.PlainDate.from("+275760-09-13"), (d) => d.until(d.with({ month: 10, day: 1 })).days) // 18
 */
export function measureNearRangeEnd<T extends ShiftableByDays<T>, R>(
  source: T,
  measure: (from: T) => R,
): R {
  try {
    return measure(source);
  } catch (error) {
    const cycles = Math.floor(
      (source.withCalendar("iso8601").year - PROXY_FLOOR_YEAR) / 400,
    );
    if (cycles <= 0 || !GREGORIAN_STRUCTURED_CALENDARS.has(source.calendarId)) {
      throw error;
    }
    return measure(source.subtract({ days: cycles * GREGORIAN_CYCLE_DAYS }));
  }
}
