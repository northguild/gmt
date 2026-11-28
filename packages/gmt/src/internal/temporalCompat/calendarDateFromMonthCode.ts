import { Temporal } from "../temporal";

/** TC39 `ISODateWithinLimits`: the first and last representable dates. */
const LIMITS = ["-271821-04-19", "+275760-09-13"] as const;
const MONTH_CODE = /^M(\d{2})(L?)$/;

/** The calendar year of the first and the last representable date. */
function edgeYears(calendarId: string): readonly [number, number] {
  const [first, last] = LIMITS.map(
    (limit) => Temporal.PlainDate.from(limit).withCalendar(calendarId).year,
  );
  return [first as number, last as number];
}

/**
 * The date of `day` of `monthCode` in calendar year `year`, or null when that year has no such
 * month (M05L in a common Hebrew year, M13 in iso8601) or that month no such day, and for a date
 * beyond Temporal's range limit in a calendar year the limit cuts. Throws a RangeError when the
 * calendar year lies wholly outside Temporal's range, or `monthCode` is not a month code.
 *
 * The date is Temporal's own `PlainDate.from` with `overflow: "reject"`, so nothing is
 * constrained: a date that does not exist is `null`, as RFC 5545 §3.3.10 and RFC 7529 §4.1 skip it.
 *
 * @returns the date as an ISO-calendar PlainDate, or null
 */
export function calendarDateFromMonthCode(
  calendarId: string,
  year: number,
  monthCode: string,
  day: number,
): Temporal.PlainDate | null {
  if (!MONTH_CODE.test(monthCode)) {
    throw new RangeError(`Invalid month code: ${monthCode}`);
  }
  try {
    return Temporal.PlainDate.from(
      { calendar: calendarId, year, monthCode, day },
      { overflow: "reject" },
    ).withCalendar("iso8601");
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
    // A year that holds a date of the range has no such month or day, or the date lies past a
    // limit (15 Sivan of Hebrew 279517 falls after +275760-09-13): not a representable date.
    const [first, last] = edgeYears(calendarId);
    if (year >= first && year <= last) {
      return null;
    }
    throw error;
  }
}

/**
 * The years read for a month code's longest length. Thirty-three years hold a leap year of every
 * calendar GMT accepts (the Persian cycle, the longest, is 33 years) and a complete Hebrew year,
 * whose Heshvan and Kislev have 30 days.
 */
const CYCLE_YEARS = 33;
/** The span starts in the calendar year of this date, far from the range limits. */
const CYCLE_START = "2000-01-01";

const longestDays = new Map<string, number>();

/** The days in `monthCode` of `year`, or 0 when that year has no such month. */
function daysInMonthCode(
  calendarId: string,
  year: number,
  monthCode: string,
): number {
  try {
    return Temporal.PlainDate.from(
      { calendar: calendarId, year, monthCode, day: 1 },
      { overflow: "reject" },
    ).daysInMonth;
  } catch (error) {
    if (error instanceof RangeError) {
      return 0;
    }
    throw error;
  }
}

/**
 * The most days `monthCode` has in any year of `calendarId`: 30 for Hebrew `M01`, 6 for `M13` in
 * `ethioaa`, 29 for `M02` in `islamic-civil`. It is read from the calendar over one cycle of years
 * (`CYCLE_YEARS`), never from a table, and kept per calendar and month code. 0 when no year of the
 * cycle has the month (`M13` in iso8601).
 */
export function longestDayOfMonthCode(
  calendarId: string,
  monthCode: string,
): number {
  const key = `${calendarId} ${monthCode}`;
  const known = longestDays.get(key);
  if (known !== undefined) {
    return known;
  }

  const first =
    Temporal.PlainDate.from(CYCLE_START).withCalendar(calendarId).year;
  let longest = 0;
  for (let year = first; year < first + CYCLE_YEARS; year++) {
    longest = Math.max(longest, daysInMonthCode(calendarId, year, monthCode));
  }
  longestDays.set(key, longest);

  return longest;
}
