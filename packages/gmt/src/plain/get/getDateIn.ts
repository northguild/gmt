// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { plainDateAdd } from "../../internal/plainDateAdd";
import { readLengthUnits } from "../../internal/lengthFromNow";
import { nowZonedDateTimeISO } from "../../internal/temporalCompat";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import type { DateDurationUnit } from "../../types";
import { isValidDateDurationUnit } from "../validate/isValidDateDurationUnit";

/**
 * Return the PlainDate after today, as an ISO string, counted from the current time.
 *
 * - Reads the clock once, after `units` is checked.
 * - `units` is an object of unit amounts (years, months, weeks, days), such as `{ days: 90 }`. A
 *   duration string returns "". A time unit returns "", even at zero, as `addDate` does; use
 *   `getDateTimeIn` or `getZonedIn` for hours. A fractional amount returns "": use whole days.
 * - Lengths are unsigned: a negative amount returns "". `getDateAgo` is the way back.
 * - `{ days: 0 }` is a valid length and gives today, so
 *   `getDateIn({ days: 0 })` equals `getToday()`.
 * - Counts from today in the system time zone, so a server's result changes with its zone;
 *   `getZonedIn` names one.
 * - A missing day clamps to the end of the month: 31 January plus a month is
 *   28 February, or 29 in a leap year.
 * - Each call reads the clock. To pin the start, use `addDate(getToday(), units)`.
 * - Examples read the clock at 2027-06-15T12:00:00Z, with the system time zone UTC.
 *
 * @param units unit amounts, such as `{ days: 90 }`; never negative
 * @returns ISO PlainDate string, or "" for invalid `units`, a negative amount, a time unit,
 *   an unavailable system zone or a result outside Temporal's range
 *
 * @example getDateIn({ days: 90 }) // "2027-09-13"
 * @example getDateIn({ months: 1 }) // "2027-07-15"
 * @example getDateIn({ days: -1 }) // "" (lengths are unsigned)
 * @example getDateIn({ hours: 36 } as never) // "" (a time unit)
 */
export function getDateIn(
  units: Partial<Record<DateDurationUnit, number>>,
): string {
  try {
    const amounts = readLengthUnits(units, isValidDateDurationUnit);
    if (amounts === null) {
      return "";
    }

    const timeZone = getSystemTimeZone();
    if (!timeZone) {
      return "";
    }

    const today = nowZonedDateTimeISO(timeZone).toPlainDate();
    return plainDateAdd(today, amounts, "constrain").toString();
  } catch {
    // Never throws (Core Rule 3): a hostile argument, or a result past Temporal's range, is
    // invalid input, not an exception.
    return "";
  }
}
