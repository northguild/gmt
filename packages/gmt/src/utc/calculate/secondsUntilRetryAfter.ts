import { Temporal } from "../../internal/temporal";
import { wholeSecondsUntil } from "../../internal/lengthFromNow";
import { nowInstant } from "../../internal/temporalCompat";
import { parseHttpDate } from "../parse/parseHttpDate";

// RFC 9110 section 10.2.3: delay-seconds = 1*DIGIT. `\d` is ASCII-only in ECMA-262, and
// `$` without the `m` flag does not match before a trailing newline.
const DELAY_SECONDS = /^\d+$/;

/**
 * Return the whole seconds to wait from a `Retry-After` header value.
 *
 * - Takes the header's value: `Retry-After = HTTP-date / delay-seconds` (RFC 9110 section 10.2.3),
 *   and `delay-seconds = 1*DIGIT`.
 * - Digits are returned as they are, leading zeros allowed, without reading the clock. A value
 *   past the largest safe integer returns null.
 * - An HTTP-date is read through `parseHttpDate` (all three formats) and measured from now,
 *   rounded up to a whole second so a wait never falls short.
 * - **A past HTTP date gives a negative number.** Check `null` first, then wait `Math.max(0, n)`:
 *   `Math.max(0, null)` is 0, so an unchecked garbage value means "retry now".
 * - **A `:60` leap second returns null**, though RFC 9110 section 5.6.7 allows it (its
 *   `time-of-day` comment reads "00:00:00 - 23:59:60 (leap second)"): GMT's `parseHttpDate`
 *   refuses every second above 59.
 * - `null` is invalid input only: an empty or unparsable string such as `"soon"`, a sign, a
 *   space, a fraction, non-ASCII digits, digits past the largest safe integer, a non-string, or
 *   an HTTP-date with a `:60` second.
 * - No `timeZone`: an HTTP-date is always GMT.
 *
 * @param value the header's value: digits, or an HTTP-date
 * @returns the seconds to wait, negative for a past date, or null for anything else
 *
 * @example secondsUntilRetryAfter("120") // 120 (delay-seconds)
 * @example secondsUntilRetryAfter("Fri, 18 Jun 2027 12:00:00 GMT") // 259200 (3 days, from a clock at Tue, 15 Jun 2027 12:00:00 GMT)
 * @example secondsUntilRetryAfter("") // null
 * @example secondsUntilRetryAfter("-5") // null (no sign in delay-seconds)
 * @example secondsUntilRetryAfter("soon") // null
 */
export function secondsUntilRetryAfter(value: string): number | null {
  try {
    if (typeof value !== "string") {
      return null;
    }

    if (DELAY_SECONDS.test(value)) {
      const delay = Number(value);
      return Number.isSafeInteger(delay) ? delay : null;
    }

    const utc = parseHttpDate(value);
    if (utc === "") {
      return null;
    }

    return wholeSecondsUntil(Temporal.Instant.from(utc), nowInstant());
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return null;
  }
}
