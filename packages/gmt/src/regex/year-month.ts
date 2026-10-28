/**
 * RegExp matching an ISO 8601 year-month in the extended form: `YYYY-MM` or `±YYYYYY-MM`.
 *
 * - The year is the `year` regex: Temporal's `DateYear`, four digits or a sign and six digits,
 *   with `-000000` refused (its early error).
 * - The extended form only. `202610` does not match, as `plainDate` refuses `20241225`.
 * - The shape only: the range (`-271821-04` to `+275760-09`) is Temporal's, checked by
 *   `isValidYearMonth`.
 *
 * Capture groups: none.
 *
 * The written form only, with no RFC 9557 annotation. `isValidYearMonth` matches this against
 * the part before the first `[` and lets Temporal read the annotations.
 *
 * @example plainYearMonth.test("2026-10")    // true
 * @example plainYearMonth.test("+275760-09") // true
 * @example plainYearMonth.test("+999999-12") // true (shape only; outside Temporal's range)
 * @example plainYearMonth.test("202610")     // false (basic format)
 * @example plainYearMonth.test("2026-13")    // false (month 13)
 * @example plainYearMonth.test("2026-10-01") // false (a full date)
 */
export const plainYearMonth: RegExp =
  /^(?:\d{4}|\+\d{6}|-(?!0{6})\d{6})-(?:0[1-9]|1[0-2])$/;
