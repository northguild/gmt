import { Temporal } from "../temporal";
import { arithmeticModelFor } from "./calendarDateArithmetic";
import type { ArithmeticModel } from "./nonIsoArithmetic";

/** TC39 `ISODateWithinLimits`: the first and last representable dates. */
const LIMITS = ["-271821-04-19", "+275760-09-13"];

/**
 * The date of `day` of `monthCode` in calendar year `year`, or null when that year has no such
 * month (M05L in a common Hebrew year, M13 in iso8601) or that month no such day, and for a date
 * beyond Temporal's range limit in a calendar year the limit cuts. Throws a RangeError when the
 * calendar year lies wholly outside Temporal's range.
 *
 * Month codes are resolved as the Intl Era and Month Code proposal does (`monthOrdinal`), and the
 * day is checked against the month's length, so nothing is constrained: a date that does not exist
 * is `null`, as RFC 5545 §3.3.10 and RFC 7529 §4.1 skip it. The model is the owned one where the
 * runtime's reads are corrected (hebrew, indian), the read-backed one otherwise.
 *
 * @returns the date as an ISO-calendar PlainDate, or null
 */
export function calendarDateFromMonthCode(
  calendarId: string,
  year: number,
  monthCode: string,
  day: number,
): Temporal.PlainDate | null {
  const model = arithmeticModelFor(calendarId);
  const month = model.monthOrdinal(year, monthCode);

  if (month === "missing") {
    return null;
  }
  try {
    if (month === null) {
      // No ordinal could be read: either the calendar has no such month code in a year it can read
      // (iso8601 M13), which is null, or no day of the month is in range, which the catch decides.
      model.toDate(year, 1, 1);

      return null;
    }

    // A month cut by a Temporal range limit (September +275760) has no readable length: its days
    // up to the limit exist.
    const length = model.daysInMonth({ year, month });

    return length !== null && length < day
      ? null
      : model.toDate(year, month, day);
  } catch (error) {
    // A date beyond a limit, in the calendar year that holds the limit, is not a representable
    // date (15 Sivan of Hebrew 279517 falls after +275760-09-13). Any other year throws.
    if (error instanceof RangeError && isEdgeYear(model, year)) {
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
/** The span starts in the calendar year of this date, far from the range limits the polyfill misreads. */
const CYCLE_START = "2000-01-01";

const longestDays = new Map<string, number>();

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

  const model = arithmeticModelFor(calendarId);
  const first = model.fields(Temporal.PlainDate.from(CYCLE_START)).year;
  let longest = 0;
  for (let year = first; year < first + CYCLE_YEARS; year++) {
    const month = model.monthOrdinal(year, monthCode);
    const days =
      typeof month === "number" ? model.daysInMonth({ year, month }) : null;
    longest = Math.max(longest, days ?? 0);
  }
  longestDays.set(key, longest);

  return longest;
}

/** Whether calendar `year` holds one of Temporal's range limits, so it has dates on both sides. */
function isEdgeYear(model: ArithmeticModel, year: number): boolean {
  return LIMITS.some(
    (limit) => model.fields(Temporal.PlainDate.from(limit)).year === year,
  );
}
