/**
 * RegExp matching RFC 5322 §3.3 date-time grammar (obsoletes RFC 2822, same shape).
 * English day/month names are mandated by the spec regardless of locale — see
 * `internal/englishCalendarNames.ts`. Day is `1*2DIGIT` per the formal grammar, so
 * single-digit days are valid on input even though GMT's own formatter always emits the
 * zero-padded 2-digit form. `zone` accepts a numeric offset or one of the obsolete named
 * zones RFC 5322 §4.3 lists (UT/GMT plus the eight North American zones); any other
 * obs-zone letter is unrecognized and treated as invalid rather than guessed at.
 *
 * Capture groups: 1 day-of-week (optional, for weekday-prefixed form), 2 day, 3 month,
 * 4 year, 5 hour, 6 minute, 7 second (optional), 8 zone.
 *
 * @example rfc2822DateTime.test("Wed, 09 Jun 2021 10:18:14 GMT")   // true
 * @example rfc2822DateTime.test("09 Jun 2021 10:18:14 +0000")       // true (no weekday)
 * @example rfc2822DateTime.test("9 Jun 2021 10:18:14 PST")         // true (single-digit day)
 * @example rfc2822DateTime.test("Wed, 09 Jun 2021 10:18:14 EST")   // true (named zone)
 * @example rfc2822DateTime.test("2024-03-15T14:30:00Z")            // false (ISO shape)
 */
export const rfc2822DateTime: RegExp =
  /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun), )?(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2})(?::(\d{2}))? (UT|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|[+-]\d{4})$/;
