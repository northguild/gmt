import { parseSwiftDate } from "../parse/parseSwiftDate";

/**
 * Return true when `value` is a SWIFT MT value date, `YYMMDD`, that SWIFT accepts.
 *
 * - **True exactly when `parseSwiftDate` returns a date** for the same value. It calls the
 *   parser, so the two cannot disagree.
 * - **It needs no options.** SWIFT's value-date rule fixes the century (`YY` above 79 is
 *   19`YY`, the rest 20`YY`, and a year after 2060 is refused), so a value is valid or not on
 *   its own: `000229` is valid (2000) and `750101` is not (2075, error T50).
 * - False for a value that is not a string.
 *
 * @param value The value to check
 * @returns `true` for a value date SWIFT accepts, or `false` on invalid input
 *
 * @example isValidSwiftDate("240615") // true
 * @example isValidSwiftDate("000229") // true
 * @example isValidSwiftDate("750101") // false
 * @example isValidSwiftDate("241315") // false
 * @example isValidSwiftDate("850229") // false
 */
export function isValidSwiftDate(value: string): boolean {
  return parseSwiftDate(value) !== "";
}
