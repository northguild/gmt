import { plainMonthDayOf } from "../../internal/inputChecks";

/**
 * Return true if `value` is a valid ISO month-day string: `--MM-DD` or `MM-DD`.
 *
 * - The part before the first annotation must match `plainMonthDay`: the extended form only
 *   (`--1225` and `1225` are refused, as `isValidDate` refuses `20241225`), with a day that exists
 *   in at least one year. `--02-29` is valid; `--02-30` and `--04-31` are not.
 * - Reads RFC 9557 annotations as `Temporal.PlainMonthDay.from` does: elective ones (`[foo=bar]`)
 *   and a time zone annotation are ignored, and an unknown critical one (`[!foo=bar]`) is
 *   rejected.
 * - The calendar must be `iso8601`, in any case (`[u-ca=ISO8601]` is accepted); any other
 *   calendar is refused, because a month-day without a year is read only in the ISO calendar.
 * - Rejects a year, a time, a `Z` and an offset.
 * - Returns false for anything that is not a string.
 *
 * @param value ISO month-day string
 * @returns boolean indicating validity
 *
 * @example isValidMonthDay("--12-25") // true
 * @example isValidMonthDay("12-25") // true (the -- is optional)
 * @example isValidMonthDay("--02-29") // true (exists in the 1972 reference year)
 * @example isValidMonthDay("--12-25[u-ca=ISO8601]") // true
 * @example isValidMonthDay("--02-30") // false (no such day in any year)
 * @example isValidMonthDay("--1225") // false (basic format)
 * @example isValidMonthDay("--12-25[u-ca=gregory]") // false (only iso8601)
 * @example isValidMonthDay("2024-12-25") // false (a date, not a month-day)
 * @example isValidMonthDay("") // false
 */
export function isValidMonthDay(value: string): boolean {
  return plainMonthDayOf(value) !== null;
}
