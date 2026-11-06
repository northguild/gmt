// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { Temporal } from "../../internal/temporal";
import { plainDateAdd } from "../../internal/plainDateAdd";
import { readLengthUnits } from "../../internal/lengthFromNow";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import type { DateDurationUnit } from "../../types";
import { isValidDateDurationUnit } from "../validate/isValidDateDurationUnit";

/**
 * Return the PlainDate before today, as an ISO string, counted from the current time.
 *
 * - Reads the clock once, after `units` is checked.
 * - `units` is an object of unit amounts (years, months, weeks, days), such as `{ days: 90 }`. A
 *   duration string returns "". A time unit returns "", even at zero, as `subtractDate` does; use
 *   `getDateTimeAgo` or `getZonedAgo` for hours. A fractional amount returns "": use whole days.
 * - Lengths are unsigned: a negative amount returns "". `getDateIn` counts forward.
 * - `{ days: 0 }` is a valid length and gives today, so
 *   `getDateAgo({ days: 0 })` equals `getToday()`.
 * - Counts from today in the system time zone, so a server's result changes with its zone;
 *   `getZonedAgo` names one.
 * - A missing day clamps to the end of the month: 31 March minus a month is
 *   28 February, or 29 in a leap year.
 * - Each call reads the clock. To pin the start, use `subtractDate(getToday(), units)`.
 * - Examples read the clock at 2027-06-15T12:00:00Z, with the system time zone UTC.
 *
 * @param units unit amounts, such as `{ days: 90 }`; never negative
 * @returns ISO PlainDate string, or "" for invalid `units`, a negative amount, a time unit,
 *   an unavailable system zone or a result outside Temporal's range
 *
 * @example getDateAgo({ days: 90 }) // "2027-03-17"
 * @example getDateAgo({ months: 1 }) // "2027-05-15"
 * @example getDateAgo({ days: -1 }) // "" (lengths are unsigned)
 * @example getDateAgo({ hours: 36 } as never) // "" (a time unit)
 */
export function getDateAgo(
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

    const today = Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate();
    return plainDateAdd(
      today,
      Temporal.Duration.from(amounts).negated(),
      "constrain",
    ).toString();
  } catch {
    // Never throws (Core Rule 3): a hostile argument, or a result past Temporal's range, is
    // invalid input, not an exception.
    return "";
  }
}
