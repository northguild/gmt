import { parseRfc3339 } from "../parse/parseRfc3339";

/**
 * Return true when `value` is a real RFC 3339 date-time: an ISO 8601 date and time that always
 * states its UTC offset, as `Z` or `±HH:MM` (RFC 3339 §5.6).
 *
 * - True exactly when `parseRfc3339` returns a zoned string for the same value: the validator
 *   calls the parser, so the two cannot disagree.
 * - Checks the calendar as well as the shape. The `rfc3339DateTime` pattern proves the shape
 *   alone, so it matches a day that does not exist: 29 February in a common year and 31 June are
 *   false here.
 * - Accepts `T`, `t` or a single space between the date and the time, `Z` or `z`, a numeric
 *   offset from `-23:59` to `+23:59`, and up to nine fraction digits.
 * - False for a leap second (`:60`), although §5.6 `time-second` admits it: GMT rejects leap
 *   seconds because Temporal would read one as `:59`.
 * - False for GMT's own zoned strings, which carry a bracketed zone (`...+00:00[UTC]`): that
 *   annotation is not RFC 3339. Check those with `isValidZonedDateTime`.
 * - False for a non-string. Read the value with `parseRfc3339`; write one with `formatRfc3339`.
 *
 * @param value candidate RFC 3339 date-time string
 * @returns boolean indicating validity
 *
 * @example isValidRfc3339DateTime("2024-03-15T14:30:00-04:00") // true
 * @example isValidRfc3339DateTime("2024-03-15t14:30:00z") // true (lower-case t and z)
 * @example isValidRfc3339DateTime("2024-03-15 14:30:00.5Z") // true (space separator, fraction)
 * @example isValidRfc3339DateTime("2023-02-29T10:00:00Z") // false (2023 has no 29 February; the rfc3339DateTime pattern matches it)
 * @example isValidRfc3339DateTime("2024-06-31T10:00:00Z") // false (June has 30 days; the rfc3339DateTime pattern matches it)
 * @example isValidRfc3339DateTime("2016-12-31T23:59:60Z") // false (leap second)
 * @example isValidRfc3339DateTime("2024-03-15T14:30:00") // false (no offset)
 * @example isValidRfc3339DateTime("2024-03-15T14:30:00+00:00[UTC]") // false (bracketed zone: use isValidZonedDateTime)
 * @example isValidRfc3339DateTime("not a date") // false
 */
export function isValidRfc3339DateTime(value: string): boolean {
  return parseRfc3339(value) !== "";
}
