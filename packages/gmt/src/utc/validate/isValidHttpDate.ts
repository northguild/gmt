import { parseHttpDate } from "../parse/parseHttpDate";

/**
 * Return true when `value` is a real HTTP header date: the RFC 9110 §5.6.7 HTTP-date that
 * headers like `Last-Modified`, `Date` and `Expires` carry, such as
 * `Fri, 15 Mar 2024 14:30:00 GMT`.
 *
 * - True exactly when `parseHttpDate` returns a UTC string for the same value: the validator
 *   calls the parser, so the two cannot disagree.
 * - **All three HTTP-date formats**, which RFC 9110 §5.6.7 says a recipient "MUST accept":
 *   IMF-fixdate, and the obsolete rfc850-date (`Sunday, 06-Nov-94 08:49:37 GMT`) and asctime-date
 *   (`Sun Nov  6 08:49:37 1994`). The `httpDate` pattern matches IMF-fixdate alone.
 * - Checks the calendar as well as the shape. The pattern matches a day that does not exist:
 *   `31 Feb`, `29 Feb 2023` and `31 Jun` are false here.
 * - **The day name must match the date, in all three formats.** The pattern does not check it.
 * - False for an hour above 23 and a minute above 59, which the pattern matches. False for a
 *   second of 60: GMT rejects leap seconds.
 * - HTTP-date is case-sensitive and fixed-width, and its zone is the literal `GMT`: a numeric
 *   offset is false.
 * - **An rfc850-date reads the clock.** Its two-digit year is read against the current instant
 *   (`Temporal.Now.instant()`), as `parseHttpDate` describes, so the same string can change its
 *   answer decades apart; if the clock cannot be read the answer is false. The other two formats
 *   never read the clock.
 * - False for a non-string. Read the value with `parseHttpDate`; write one with `formatHttpDate`.
 *
 * @param value candidate RFC 9110 HTTP-date string
 * @returns boolean indicating validity
 *
 * @example isValidHttpDate("Fri, 15 Mar 2024 14:30:00 GMT") // true
 * @example isValidHttpDate("Sun Nov  6 08:49:37 1994") // true (asctime-date; the httpDate pattern does not match it)
 * @example isValidHttpDate("Sat, 15 Mar 2024 14:30:00 GMT") // false (15 Mar 2024 was a Friday; the httpDate pattern matches it)
 * @example isValidHttpDate("Wed, 29 Feb 2023 14:30:00 GMT") // false (2023 has no 29 February; the httpDate pattern matches it)
 * @example isValidHttpDate("Fri, 15 Mar 2024 24:00:00 GMT") // false (hour 24; the httpDate pattern matches it)
 * @example isValidHttpDate("Fri, 15 Mar 2024 14:30:00 -0400") // false (not an HTTP-date)
 * @example isValidHttpDate("not a date") // false
 */
export function isValidHttpDate(value: string): boolean {
  return parseHttpDate(value) !== "";
}
