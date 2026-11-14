import { plainMonthDayOf } from "../../internal/inputChecks";

/**
 * Return true if `value` is a valid ISO month-day string: `--MM-DD` or `MM-DD`.
 *
 * - The whole string must match `plainMonthDay`: the extended form only
 *   (`--1225` and `1225` are refused, as `isValidDate` refuses `20241225`), with a day that exists
 *   in at least one year. `--02-29` is valid; `--02-30` and `--04-31` are not.
 * - Accepts no annotation of any kind: a time zone, a calendar (`[u-ca=iso8601]`) or an
 *   elective one (`[foo=bar]`) returns `false`.
 * - Rejects a year, a time, a `Z` and an offset.
 * - A value that is not a string, a `String` object included, returns `false`. A `true` result
 *   narrows an `unknown` value to `string`.
 *
 * @param value any value; a string is checked as an ISO month-day
 * @returns boolean indicating validity
 *
 * @example isValidMonthDay("--12-25") // true
 * @example isValidMonthDay("12-25") // true (the -- is optional)
 * @example isValidMonthDay("--02-29") // true (exists in the 1972 reference year)
 * @example isValidMonthDay("--12-25[u-ca=ISO8601]") // false (no annotation of any kind)
 * @example isValidMonthDay("--02-30") // false (no such day in any year)
 * @example isValidMonthDay("--1225") // false (basic format)
 * @example isValidMonthDay("--12-25[u-ca=gregory]") // false (no annotation of any kind)
 * @example isValidMonthDay("2024-12-25") // false (a date, not a month-day)
 * @example isValidMonthDay("") // false
 * @example isValidMonthDay(null) // false
 */
export function isValidMonthDay(value: string): boolean;
export function isValidMonthDay(value: {} | null | undefined | void): boolean;
export function isValidMonthDay(value: unknown): value is string;
export function isValidMonthDay(value: unknown): boolean {
  return plainMonthDayOf(value) !== null;
}
