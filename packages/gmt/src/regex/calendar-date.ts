/**
 * RegExp matching a calendar-annotated PlainDate string in the RFC 9557 form Temporal writes and
 * reads: the ISO 8601 date, then one `[u-ca=<id>]` calendar annotation. The digits are always
 * ISO; the annotation only names the calendar the date is presented in (RFC 9557 §3.3). This is
 * exactly `Temporal.PlainDate#toString()` for a non-ISO calendar.
 *
 * YEAR: Temporal's `DateYear`, four digits or a sign plus six digits (`2024`, `+275760`,
 * `-271821`), with `-000000` rejected as Temporal's early error rejects it.
 *
 * ANNOTATION: RFC 9557's `u-ca` key, lower-case, optionally with the critical flag
 * (`[!u-ca=hebrew]`, which Temporal's `ParseISODateTime` accepts for a single calendar
 * annotation). The value is alphanumeric components joined by single hyphens, in any case;
 * `CanonicalizeCalendar` validates and lower-cases it. `;era=` is not RFC 9557 syntax.
 *
 * A match proves shape only: `Temporal.PlainDate.from` validates the date and the calendar id.
 * This is the written form. GMT's calendar functions read more (`isValidCalendarDate`): a date-time
 * in `plainDateTime`'s strict shape before the annotations (`"2024-10-03T14:30[u-ca=hebrew]"`, read
 * as its date), and the rest of Temporal's annotation grammar, such as a time zone annotation or an
 * elective `[foo=bar]`, which Temporal ignores. Basic format, a space or lower-case `t` separator
 * and a UTC offset are rejected there as well as here.
 *
 * Capture groups: 1 year, 2 month, 3 day, 4 critical flag (`"!"` or undefined), 5 calendar id.
 *
 * @example calendarDate.test("2024-10-03[u-ca=hebrew]")          // true
 * @example calendarDate.test("+275760-09-13[u-ca=hebrew]")       // true
 * @example calendarDate.test("2024-10-03[!u-ca=japanese]")       // true (critical flag)
 * @example calendarDate.test("0006-10-03[u-ca=japanese;era=reiwa]") // false (not RFC 9557)
 * @example calendarDate.test("279517-10-11[u-ca=hebrew]")        // false (a six-digit year needs a sign)
 * @example calendarDate.test("2024-03-15")                       // false (no calendar annotation)
 */
export const calendarDate: RegExp =
  /^(\d{4}|\+\d{6}|-(?!0{6})\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\[(!)?u-ca=([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\]$/;
