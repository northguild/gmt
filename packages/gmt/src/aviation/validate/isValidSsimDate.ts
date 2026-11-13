import { readSsimDate } from "../../internal/ssimDate";
import type { TwoDigitYearOptions } from "../../types/two-digit-year";

/**
 * Return true when `value` is a real SSIM date (`DDMMMYY`) in the stated hundred-year window.
 *
 * - **True exactly when `parseSsimDate` returns a date** for the same arguments. It calls the
 *   parser, so the two cannot disagree.
 * - **It needs the window.** A day is real only once its century is known: `29FEB00` is valid
 *   with a window from 2000 and not with one from 1900. It is false without `yearWindow`.
 * - **Locale-independent**, as the parser is: the month letters are a fixed upper-case English
 *   code, never read through `Intl`.
 *
 * @param value The value to check
 * @param options The hundred-year window a two-digit year is read in
 * @returns `true` for a real SSIM date in the window, or `false` on invalid input
 *
 * @example isValidSsimDate("01JAN26", { yearWindow: 2000 }) // true
 * @example isValidSsimDate("29FEB00", { yearWindow: 2000 }) // true
 * @example isValidSsimDate("29FEB00", { yearWindow: 1900 }) // false
 * @example isValidSsimDate("01jan26", { yearWindow: 2000 }) // false
 * @example isValidSsimDate("31APR26", { yearWindow: 2000 }) // false
 * @example isValidSsimDate("01JAN26", {}) // false
 */
export function isValidSsimDate(
  value: string,
  options: TwoDigitYearOptions,
): boolean {
  return readSsimDate(value, options) !== "";
}
