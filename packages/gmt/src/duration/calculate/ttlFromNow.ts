import { imfFixdate } from "../../internal/englishCalendarNames";
import {
  addLengthToStart,
  readLengthUnits,
  utcLengthFrame,
  wholeMillisecondsUntil,
  wholeSecondsUntil,
} from "../../internal/lengthFromNow";
import { nowInstant } from "../../internal/temporalCompat";
import { toUnixEpoch } from "../../internal/unixEpochValue";
import { isDateTimeDurationUnitName } from "../../internal/unitNames";
import type { DateTimeDurationUnit } from "../../types";

/**
 * One length from now, in each form a receiver wants. All five come from one clock read, so
 * `epochSeconds`, `httpDate` and `iso` name the same second. `seconds` and `milliseconds` round
 * up, so they can exceed the floored forms: for `{ milliseconds: 1500 }`, `seconds` is 2. From
 * a clock on a whole second `epochSeconds` is now plus 1; from a clock at .800 it is the floored
 * now plus 2.
 */
export interface Ttl {
  /** Whole seconds, rounded up: a cookie `Max-Age` or a cache `max-age`. */
  seconds: number;
  /** Whole milliseconds, rounded up: a timer delay. */
  milliseconds: number;
  /** The end as whole Unix seconds, floored: a JWT `exp`. */
  epochSeconds: number;
  /** The end as an IMF-fixdate (RFC 9110 section 5.6.7): a cookie `Expires`. */
  httpDate: string;
  /** The end as UTC text in whole seconds, floored. */
  iso: string;
}

/**
 * Express one length of time from now in every form a receiver wants: seconds, milliseconds, a
 * Unix epoch, an HTTP date and a UTC string.
 *
 * - Use it when one length goes to several receivers, such as a cookie's `Max-Age` and `Expires`
 *   beside a token's `exp`. Every field comes from one clock read; separate calls can straddle a
 *   second.
 * - `seconds` and `milliseconds` round up, so a wait never falls short. `epochSeconds`, `httpDate`
 *   and `iso` floor to the same second.
 * - Counts in UTC, so the result does not change with the server's zone. A missing day clamps to
 *   the end of the month, as `addUtc` does. No 400-day cap is applied.
 * - `units` is an object of unit amounts, such as `{ days: 90 }`. A duration string returns null. A
 *   fractional amount returns null: write `{ hours: 36 }` for a day and a half.
 * - Lengths are unsigned: a negative amount returns null.
 * - `{ days: 0 }` gives `seconds: 0`. RFC 6265 section 4.1.1's server grammar has no zero
 *   `Max-Age` (`non-zero-digit *DIGIT`), though receivers accept one (section 5.2.2).
 * - A year past 9999 returns null, because `httpDate` has no four-digit form (RFC 9110
 *   section 5.6.7). The whole result is null so a non-null result is usable in full.
 *   `getUtcIn` and `getUnixIn` reach those years.
 * - Examples read the clock at 2027-06-15T12:00:00Z.
 *
 * @param units unit amounts, such as `{ days: 90 }`; never negative
 * @returns the length in each form, or null for invalid `units`, a negative amount, a result
 *   outside Temporal's range or a year past 9999
 *
 * @example ttlFromNow({ days: 1 })?.seconds // 86400 (a cookie Max-Age for one day)
 * @example ttlFromNow({ days: 1 })?.httpDate // "Wed, 16 Jun 2027 12:00:00 GMT" (the matching Expires)
 * @example ttlFromNow({ days: -1 }) // null (lengths are unsigned)
 * @example ttlFromNow({ years: 8000 }) // null (year 10027 has no four-digit form)
 */
export function ttlFromNow(
  units: Partial<Record<DateTimeDurationUnit, number>>,
): Ttl | null {
  try {
    const amounts = readLengthUnits(units, isDateTimeDurationUnitName);
    if (amounts === null) {
      return null;
    }

    const start = nowInstant();
    const end = addLengthToStart(start, amounts, utcLengthFrame());
    const httpDate = imfFixdate(end.toZonedDateTimeISO("UTC"));
    if (httpDate === "") {
      return null;
    }

    return {
      seconds: wholeSecondsUntil(end, start),
      milliseconds: wholeMillisecondsUntil(end, start),
      epochSeconds: toUnixEpoch(end, "seconds"),
      httpDate,
      iso: end.toString({ smallestUnit: "second", roundingMode: "floor" }),
    };
  } catch {
    // Never throws (Core Rule 3): a hostile argument, or a result past Temporal's range, is
    // invalid input, not an exception.
    return null;
  }
}
