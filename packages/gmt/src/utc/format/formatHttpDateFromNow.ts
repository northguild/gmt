import { Temporal } from "../../internal/temporal";
import { imfFixdate } from "../../internal/englishCalendarNames";
import {
  addLengthToStart,
  readLengthUnits,
  utcLengthFrame,
} from "../../internal/lengthFromNow";
import { isValidDateTimeDurationUnit } from "../../plain/validate/isValidDateTimeDurationUnit";
import type { DateTimeDurationUnit } from "../../types";

/**
 * Return the RFC 9110 HTTP date (IMF-fixdate) after now, counted from the current time. It is the
 * value for an `Expires` attribute or header.
 *
 * - Reads the clock once, after `units` is checked.
 * - `units` is an object of unit amounts, such as `{ days: 90 }`. A duration string returns "". A
 *   fractional amount returns "": write `{ hours: 36 }` for a day and a half.
 * - `totalUnitsFromNow` gives the `Max-Age` that goes with it. When both are sent, `Max-Age`
 *   controls (RFC 6265 §4.1.2.2), so two separate clock reads do no harm. `ttlFromNow` gives both
 *   from one read.
 * - Lengths are unsigned: a negative amount returns "". A past date, the usual way to delete a
 *   cookie, is `formatHttpDate(getUtcAgo({ days: 1 }))`.
 * - Counts in UTC, so the result does not change with the server's zone, and a missing day clamps
 *   to the end of the month, as `addUtc` does. No 400-day cap is applied.
 * - Sub-second parts are dropped: IMF-fixdate has no sub-second field.
 * - Returns "" for a year outside 0000–9999 (IMF-fixdate's `year = 4DIGIT`).
 * - It equals `formatHttpDate(getUtcIn(units))`.
 * - Examples read the clock at 2027-06-15T12:00:00Z.
 *
 * @param units unit amounts, such as `{ days: 90 }`; never negative
 * @returns RFC 9110 IMF-fixdate string, or "" for invalid `units`, a negative amount, a result
 *   outside Temporal's range or a year outside 0000–9999
 *
 * @example formatHttpDateFromNow({ days: 90 }) // "Mon, 13 Sep 2027 12:00:00 GMT" (an expiry 90 days out)
 * @example formatHttpDateFromNow({ years: 8000 }) // "" (year 10027 has no four-digit form)
 * @example formatHttpDateFromNow({ days: -1 }) // "" (lengths are unsigned)
 * @example formatHttpDateFromNow({ fortnights: 1 } as never) // "" (not a unit)
 */
export function formatHttpDateFromNow(
  units: Partial<Record<DateTimeDurationUnit, number>>,
): string {
  try {
    const amounts = readLengthUnits(units, isValidDateTimeDurationUnit);
    if (amounts === null) {
      return "";
    }

    return imfFixdate(
      addLengthToStart(
        Temporal.Now.instant(),
        amounts,
        utcLengthFrame(),
      ).toZonedDateTimeISO("UTC"),
    );
  } catch {
    // Never throws (Core Rule 3): a hostile argument, or a result past Temporal's range, is
    // invalid input, not an exception.
    return "";
  }
}
