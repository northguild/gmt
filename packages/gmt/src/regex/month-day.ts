/**
 * RegExp matching an ISO 8601 month-day (extended): `--MM-DD` or `MM-DD`.
 *
 * - The leading `--` is optional: Temporal's grammar `DateSpecMonthDay` is
 *   `` `--`? DateMonth DateSeparator DateDay ``, and RFC 3339 Appendix A writes
 *   `datespec-mday = "--" dateopt-month date-mday`.
 * - The extended form only. `--1225` and `1225` do not match, as `plainDate` refuses `20241225`.
 * - The alternation encodes the grammar's IsValidMonthDay early error, so a string that matches
 *   names a day that exists in at least one year: `--02-29` matches, `--02-30` and `--04-31` do not.
 *
 * Capture groups: none.
 *
 * The written form only, with no RFC 9557 annotation. `isValidMonthDay` matches this against the
 * part before the first `[` and lets Temporal read the annotations.
 *
 * @example plainMonthDay.test("--12-25") // true
 * @example plainMonthDay.test("12-25")   // true (the -- is optional)
 * @example plainMonthDay.test("--02-29") // true (exists in the 1972 reference year)
 * @example plainMonthDay.test("--02-30") // false (no such day in any year)
 * @example plainMonthDay.test("--1225")  // false (basic format)
 */
export const plainMonthDay: RegExp =
  /^(?:--)?(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|02-(?:0[1-9]|[12]\d))$/;
