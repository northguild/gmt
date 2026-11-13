import { wholeSecondsUntil } from "../../internal/lengthFromNow";
import { nowInstant } from "../../internal/temporalCompat";
import { httpDateInstantOf } from "../../internal/httpDateFields";

/**
 * Return the whole seconds from now until an HTTP header date, such as `Expires`.
 *
 * - Rounded up to a whole second, so a wait of that length never falls short. `result <= 0` means
 *   the date has been reached.
 * - A past date gives a negative number, and `null` is invalid input only. Check `null` first,
 *   then wait `Math.max(0, n)`: `Math.max(0, null)` is 0, so an unchecked `null` reads as "no
 *   wait".
 * - An `Expires` reader treats `null` as already expired: RFC 9111 section 5.3 says a cache
 *   "MUST interpret invalid date formats, especially the value "0", as representing a time in the
 *   past".
 * - **A `:60` leap second returns null**, though RFC 9110 section 5.6.7 allows it (its
 *   `time-of-day` comment reads "00:00:00 - 23:59:60 (leap second)"): GMT's `parseHttpDate`
 *   refuses every second above 59.
 * - Reads all three formats RFC 9110 section 5.6.7 says a recipient must accept, through
 *   `parseHttpDate`: IMF-fixdate, rfc850 and asctime. Anything `parseHttpDate` refuses returns
 *   null, a wrong weekday included.
 * - **An rfc850 date reads the clock twice**: `parseHttpDate` places its two-digit year, then this
 *   function measures the distance. The distance comes from the later read, so a wait cannot fall
 *   short.
 * - No `timeZone`: an HTTP-date is always GMT.
 * - For a `Retry-After` value, which may also be digits, use `secondsUntilRetryAfter`.
 *
 * @param value an HTTP-date, such as `Fri, 18 Jun 2027 12:00:00 GMT`
 * @returns whole seconds until `value`, negative when it is past, or null for anything that is
 *   not an HTTP-date
 *
 * @example secondsUntilHttpDate("Fri, 18 Jun 2027 12:00:00 GMT") // 259200 (3 days, from a clock at Tue, 15 Jun 2027 12:00:00 GMT)
 * @example secondsUntilHttpDate("Friday, 18-Jun-27 12:00:00 GMT") // 259200 (rfc850)
 * @example secondsUntilHttpDate("") // null
 * @example secondsUntilHttpDate("tomorrow") // null
 * @example secondsUntilHttpDate("120") // null (delay-seconds is not an HTTP-date)
 */
export function secondsUntilHttpDate(value: string): number | null {
  try {
    const instant = httpDateInstantOf(value);
    if (instant === null) {
      return null;
    }

    return wholeSecondsUntil(instant, nowInstant());
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return null;
  }
}
