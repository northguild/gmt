import { readSwiftDate } from "../../internal/swiftDate";

/**
 * Read the value date of a SWIFT MT message, `YYMMDD`, as an ISO 8601 date.
 *
 * - **What it reads.** The six-digit date component (`<DATE2>`, `6!n`) of field 30 or field 32A,
 *   such as `240615` from `:32A:240615EUR1000,00`. Pass the date component alone: a field tag,
 *   a currency, an amount or whitespace returns `""`. Digits are ASCII `0`–`9`.
 * - **The century is SWIFT's.** SWIFT fixes it for value dates: a `YY` from `01` to `60` is
 *   20`YY`, so the date runs from 2001 to 2060, and any other `YY` is refused (error T50). So
 *   `00` and `61`–`99` return `""`. The function takes no window: there is no choice to make.
 * - **Where the rule applies.** SWIFT states it for value dates: field 32A of MT 910, and fields
 *   30 and 32A of category 1 and 2 messages other than the common group messages n92, n95 and
 *   n96. SWIFT states no century for other six-digit dates, such as field 31D of MT 700; read
 *   those with `parseDateWithPattern` and the `yearWindow` you know.
 * - **Days must exist** in the year the rule gives: `040229` is 29 February 2004, and `050229`
 *   returns `""`.
 * - **Sources.** SWIFT Standards MT, MT 103 field 32A (format `6!n3!a15d`; "Date must be a valid
 *   date expressed as YYMMDD", T50), in SWIFT's Knowledge Centre, which needs a login. SWIFT
 *   _Standards MT General Information_ (Standards MT November 2025), §6.3.1 Dates and §6.3.6
 *   Value Date Ordering, which needs none:
 *   https://www2.swift.com/knowledgecentre/rest/v1/publications/usgi_20250718/2.0/usgi_20250718.pdf
 * - Returns `""` for a non-string argument.
 *
 * @param value A SWIFT value date, `YYMMDD` (e.g. "240615")
 * @returns the ISO date ("2024-06-15"), or "" on invalid input
 *
 * @example parseSwiftDate("240615") // "2024-06-15"
 * @example parseSwiftDate("601231") // "2060-12-31"
 * @example parseSwiftDate("990615") // "" (YY 99 is outside 01 to 60: SWIFT error T50)
 * @example parseSwiftDate("750101") // "" (YY 75 is outside 01 to 60: SWIFT error T50)
 * @example parseSwiftDate("040229") // "2004-02-29"
 * @example parseSwiftDate("050229") // "" (2005 is not a leap year)
 * @example parseSwiftDate("240615EUR1000,00") // "" (pass the date component alone)
 */
export function parseSwiftDate(value: string): string {
  return readSwiftDate(value);
}
