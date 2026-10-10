import { parseRfc2822 } from "../parse/parseRfc2822";

/**
 * Return true when `value` is a real RFC 5322 (RFC 2822) date-time: the date an email `Date:`
 * header carries, such as `Fri, 15 Mar 2024 14:30:00 -0400`.
 *
 * - True exactly when `parseRfc2822` returns a zoned string for the same value: the validator
 *   calls the parser, so the two cannot disagree.
 * - **Reads what a conformant receiver must**, which is more than the strict `rfc2822DateTime`
 *   pattern matches: RFC 5322 §3.3 folding white space, comments, names in any case and a year of
 *   more than four digits, and the §4 obsolete syntax (2- and 3-digit years, military and other
 *   alphabetic zones). `parseRfc2822` lists each form.
 * - Checks the calendar as well as the shape. The pattern matches a day that does not exist:
 *   `31 Feb`, `29 Feb 2023` and `31 Jun` are false here.
 * - **The day-of-week must match the date.** RFC 5322 §3.3: "the day-of-week (if included) MUST be
 *   the day implied by the date". The pattern does not check it.
 * - False for an hour above 23, a minute above 59, zone minutes above 59 and an offset of 24
 *   hours or more, all of which the pattern matches. False for a second of 60: GMT rejects leap
 *   seconds.
 * - False for a non-string. Read the value with `parseRfc2822`; write one with `formatRfc2822`.
 *
 * @param value candidate RFC 5322 date-time string
 * @returns boolean indicating validity
 *
 * @example isValidRfc2822DateTime("Fri, 15 Mar 2024 14:30:00 -0400") // true
 * @example isValidRfc2822DateTime("5 Jan 2024 09:00:00 GMT") // true (no day-of-week, 1-digit day)
 * @example isValidRfc2822DateTime("fri,15 Mar 24 14:30 -0400 (EDT)") // true (obsolete 2-digit year, comment; the rfc2822DateTime pattern does not match it)
 * @example isValidRfc2822DateTime("Sat, 15 Mar 2024 14:30:00 -0400") // false (15 Mar 2024 was a Friday; the rfc2822DateTime pattern matches it)
 * @example isValidRfc2822DateTime("Wed, 29 Feb 2023 14:30:00 -0400") // false (2023 has no 29 February; the rfc2822DateTime pattern matches it)
 * @example isValidRfc2822DateTime("Fri, 15 Mar 2024 14:30:00 -0460") // false (zone minutes above 59; the rfc2822DateTime pattern matches it)
 * @example isValidRfc2822DateTime("Fri, 15 Mar 2024 14:30:00") // false (no zone)
 * @example isValidRfc2822DateTime("not a date") // false
 */
export function isValidRfc2822DateTime(value: string): boolean {
  return parseRfc2822(value) !== "";
}
