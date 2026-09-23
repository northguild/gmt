/**
 * RegExp matching the strict shape of an RFC 5322 §3.3 date-time (obsoletes RFC 2822): the
 * single-space, case-exact form a generator writes. English day/month names are mandated by
 * the spec regardless of locale — see `internal/englishCalendarNames.ts`. Day is `1*2DIGIT` per
 * the formal grammar, so single-digit days are valid even though GMT's own formatter always
 * emits the zero-padded 2-digit form. `zone` accepts a numeric offset or one of the obsolete
 * named zones RFC 5322 §4.3 lists (UT/GMT plus the eight North American zones).
 *
 * - **A shape check, not the receiver grammar.** RFC 5322 §4 says obsolete syntax "MUST be
 *   accepted and parsed by a conformant receiver", and §3.3 itself allows folding white space,
 *   comments, lower-case names and 5-digit years. This pattern matches none of those; §4.3
 *   also says military and unknown alphabetic zones SHOULD be read as `-0000`, not rejected.
 *   `parseRfc2822` reads the full receiver grammar — use it to decode a header, and this
 *   pattern only to check that a string has the strict shape.
 * - The day-of-week is not checked against the date; `parseRfc2822` does check it.
 *
 * Capture groups: 1 day-of-week (optional, for weekday-prefixed form), 2 day, 3 month,
 * 4 year, 5 hour, 6 minute, 7 second (optional), 8 zone.
 *
 * @example rfc2822DateTime.test("Wed, 09 Jun 2021 10:18:14 GMT")   // true
 * @example rfc2822DateTime.test("09 Jun 2021 10:18:14 +0000")       // true (no weekday)
 * @example rfc2822DateTime.test("9 Jun 2021 10:18:14 PST")         // true (single-digit day)
 * @example rfc2822DateTime.test("Wed, 09 Jun 2021 10:18:14 EST")   // true (named zone)
 * @example rfc2822DateTime.test("Wed, 09 Jun 2021 10:18:14 -0400 (EDT)") // false (comment: valid RFC 5322, parseRfc2822 reads it)
 * @example rfc2822DateTime.test("2024-03-15T14:30:00Z")            // false (ISO shape)
 */
export const rfc2822DateTime: RegExp =
  /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun), )?(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2})(?::(\d{2}))? (UT|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|[+-]\d{4})$/;
