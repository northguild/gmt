/**
 * RegExp matching RFC 7231 §7.1.1.1 IMF-fixdate — the only form GMT's `formatHttp`
 * emits, and the only form `parseHttp` accepts. Day, year, and time-of-day fields are
 * all fixed-width per the grammar (unlike RFC 2822's leniently-sized day); the trailing
 * "GMT" literal is mandatory, never a numeric offset. The obsolete RFC 850 and asctime
 * HTTP-date forms are a documented limitation (see `parseHttp`'s JSDoc), not supported
 * here.
 *
 * Capture groups: 1 day-of-week, 2 day, 3 month, 4 year, 5 hour, 6 minute, 7 second.
 *
 * @example httpDate.test("Wed, 09 Jun 2021 10:18:14 GMT") // true
 * @example httpDate.test("Jun 09 2021 10:18:14 GMT")      // false (missing day-of-week)
 * @example httpDate.test("Wed, 9 Jun 2021 10:18:14 GMT")  // false (single-digit day)
 * @example httpDate.test("Wed, 09 Jun 2021 10:18:14 +0000") // false (numeric offset)
 */
export const httpDate: RegExp =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;
