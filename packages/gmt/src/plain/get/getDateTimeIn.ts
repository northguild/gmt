import { Temporal } from "../../internal/temporal";
// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { readLengthUnits } from "../../internal/lengthFromNow";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import type { DateTimeDurationUnit } from "../../types";
import { isValidDateTimeDurationUnit } from "../validate/isValidDateTimeDurationUnit";

/**
 * Return the PlainDateTime after now, as an ISO string, counted from the current time.
 *
 * - Reads the clock once, after `units` is checked.
 * - `units` is an object of unit amounts (years to nanoseconds), such as `{ days: 90 }`. A duration
 *   string returns "". A fractional amount returns "": write `{ hours: 36 }` for a day and a half.
 * - Lengths are unsigned: a negative amount returns "". `getDateTimeAgo` is the other direction.
 * - `{ days: 0 }` is a valid length and gives now.
 * - Counts on the wall clock of the system time zone. It knows nothing of daylight saving, so the
 *   result can name a time that does not exist there; `getZonedIn` gives a real instant.
 * - Whole seconds, floored. The sub-second route is `addDateTime(getNow(), units)`.
 * - A missing day clamps to the end of the month: 31 January plus a month is
 *   28 February, or 29 in a leap year.
 * - Each call reads the clock. To pin the start, use `addDateTime(getNow(), units)`.
 * - Examples read the clock at 2027-06-15T12:00:00Z, with the system time zone UTC.
 *
 * @param units unit amounts, such as `{ days: 90 }`; never negative
 * @returns ISO PlainDateTime string in whole seconds, or "" for invalid `units`, a negative amount,
 *   an unavailable system zone or a result outside Temporal's range
 *
 * @example getDateTimeIn({ days: 90 }) // "2027-09-13T12:00:00"
 * @example getDateTimeIn({ months: 1 }) // "2027-07-15T12:00:00"
 * @example getDateTimeIn({ hours: 36 }) // "2027-06-17T00:00:00"
 * @example getDateTimeIn({ days: -1 }) // "" (lengths are unsigned)
 */
export function getDateTimeIn(
  units: Partial<Record<DateTimeDurationUnit, number>>,
): string {
  try {
    const amounts = readLengthUnits(units, isValidDateTimeDurationUnit);
    if (amounts === null) {
      return "";
    }

    const timeZone = getSystemTimeZone();
    if (!timeZone) {
      return "";
    }

    return Temporal.Now.zonedDateTimeISO(timeZone)
      .toPlainDateTime()
      .add(amounts, { overflow: "constrain" })
      .toString({ smallestUnit: "second", roundingMode: "floor" });
  } catch {
    // Never throws (Core Rule 3): a hostile argument, or a result past Temporal's range, is
    // invalid input, not an exception.
    return "";
  }
}
