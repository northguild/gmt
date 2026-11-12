import { parseSwiftDate } from "../parse/parseSwiftDate";

/**
 * Return true when `value` is a SWIFT MT value date, `YYMMDD`, that SWIFT accepts.
 *
 * - **True exactly when `parseSwiftDate` returns a date** for the same value. It calls the
 *   parser, so the two cannot disagree.
 * - **It needs no options.** SWIFT's value-date rule fixes the year: a `YY` from `01` to `60`
 *   is 20`YY`, and any other is refused. So a value is valid or not on its own: `040229` is
 *   valid (2004), and `990615` and `000229` are not (error T50).
 * - False for a value that is not a string.
 *
 * @param value The value to check
 * @returns `true` for a value date SWIFT accepts, or `false` on invalid input
 *
 * @example isValidSwiftDate("240615") // true
 * @example isValidSwiftDate("040229") // true
 * @example isValidSwiftDate("990615") // false
 * @example isValidSwiftDate("000229") // false
 * @example isValidSwiftDate("241315") // false
 * @example isValidSwiftDate("050229") // false
 */
export function isValidSwiftDate(value: string): boolean {
  return parseSwiftDate(value) !== "";
}
