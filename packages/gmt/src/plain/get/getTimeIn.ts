// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { readLengthUnits } from "../../internal/lengthFromNow";
import { nowZonedDateTimeISO } from "../../internal/temporalCompat";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import type { TimeDurationUnit } from "../../types";
import { isValidTimeDurationUnit } from "../validate/isValidTimeDurationUnit";

/**
 * Return the PlainTime after now, as an ISO string, counted from the current time.
 *
 * - Reads the clock once, after `units` is checked.
 * - `units` is an object of unit amounts (hours to nanoseconds), such as `{ minutes: 15 }`. A
 *   duration string returns "". A fractional amount returns "": write `{ minutes: 90 }` for an hour
 *   and a half.
 * - Lengths are unsigned: a negative amount returns "". `getTimeAgo` is the other direction.
 * - A date unit returns "", even at zero.
 * - Wraps at midnight and carries no day, so `getTimeIn({ hours: 24 })` is the time now. For a
 *   moment that keeps its date, use `getDateTimeIn` or `getZonedIn`.
 * - Counts from now in the system time zone. Whole seconds, floored. For sub-second digits, use
 *   `addDateTime(getNow(), units)`, which also keeps the date.
 * - Examples read the clock at 2027-06-15T12:00:00Z, with the system time zone UTC.
 *
 * @param units unit amounts, such as `{ minutes: 15 }`; never negative
 * @returns ISO PlainTime string in whole seconds, or "" for invalid `units`, a date unit, a
 *   negative amount or an unavailable system zone
 *
 * @example getTimeIn({ minutes: 15 }) // "12:15:00"
 * @example getTimeIn({ hours: 36 }) // "00:00:00"
 * @example getTimeIn({ days: 1 } as never) // "" (a date unit)
 * @example getTimeIn({ hours: -1 }) // "" (lengths are unsigned)
 */
export function getTimeIn(
  units: Partial<Record<TimeDurationUnit, number>>,
): string {
  try {
    const amounts = readLengthUnits(units, isValidTimeDurationUnit);
    if (amounts === null) {
      return "";
    }

    const timeZone = getSystemTimeZone();
    if (!timeZone) {
      return "";
    }

    return nowZonedDateTimeISO(timeZone)
      .toPlainTime()
      .add(amounts)
      .toString({ smallestUnit: "second", roundingMode: "floor" });
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
