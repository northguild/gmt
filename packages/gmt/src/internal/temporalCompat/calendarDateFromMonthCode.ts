import type { Temporal } from "../temporal";
import { arithmeticModelFor } from "./calendarDateArithmetic";

/**
 * The date of `day` of `monthCode` in calendar year `year`, or null when that year has no such
 * month (M05L in a common Hebrew year, M13 in iso8601) or that month no such day, and for a day of
 * the month cut by Temporal's range limit that lies beyond the limit. Throws a RangeError when the
 * calendar year cannot be read or lies outside Temporal's range.
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
  if (month === null) {
    // No ordinal could be read: either the calendar has no such month code in a year it can read
    // (iso8601 M13), which is null, or the year itself cannot be read, which throws.
    model.toDate(year, 1, 1);

    return null;
  }

  const length = model.daysInMonth({ year, month });

  if (length === null) {
    // The month is cut by a Temporal range limit (September +275760), so its length is not
    // readable. Its days up to the limit exist, and any other day is not a representable date.
    try {
      return model.toDate(year, month, day);
    } catch (error) {
      if (error instanceof RangeError) {
        return null;
      }
      throw error;
    }
  }

  return length < day ? null : model.toDate(year, month, day);
}
