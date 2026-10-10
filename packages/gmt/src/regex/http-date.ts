/**
 * RegExp matching RFC 9110 §5.6.7 IMF-fixdate — the only form GMT's `formatHttpDate` emits and
 * the preferred HTTP-date form. Day, year, and time-of-day fields are all fixed-width per the
 * grammar (unlike RFC 5322's leniently-sized day); the trailing "GMT" literal is mandatory,
 * never a numeric offset.
 *
 * - **IMF-fixdate only.** RFC 9110 requires a recipient to accept all three HTTP-date formats;
 *   the obsolete rfc850-date and asctime-date do not match this pattern. `parseHttpDate` reads all
 *   three.
 * - The day name is not checked against the date; `parseHttpDate` does check it.
 * - To check that a string is a real HTTP-date, use `isValidHttpDate`: this pattern also matches
 *   a day that does not exist and an hour out of range.
 *
 * Capture groups: 1 day-of-week, 2 day, 3 month, 4 year, 5 hour, 6 minute, 7 second.
 *
 * @example httpDate.test("Wed, 09 Jun 2021 10:18:14 GMT") // true
 * @example httpDate.test("Jun 09 2021 10:18:14 GMT")      // false (missing day-of-week)
 * @example httpDate.test("Wed, 9 Jun 2021 10:18:14 GMT")  // false (single-digit day)
 * @example httpDate.test("Wed, 09 Jun 2021 10:18:14 +0000") // false (numeric offset)
 * @example httpDate.test("Wednesday, 09-Jun-21 10:18:14 GMT") // false (rfc850-date: parseHttpDate reads it)
 */
export const httpDate: RegExp =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;
