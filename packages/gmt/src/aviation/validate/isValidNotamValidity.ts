import type { TwoDigitYearOptions } from "../../types/two-digit-year";
import { readNotamValidity } from "../../internal/notamDateTime";

/**
 * Return true when `value` is a NOTAM item B) or C) value (`YYMMDDHHMM`, the same followed by
 * `EST`, or `PERM`) in the stated hundred-year window.
 *
 * - **True exactly when `parseNotamValidity` returns a value** for the same arguments. It calls
 *   the parser, so the two cannot disagree.
 * - **`PERM` and `EST` are valid.** The parser reads both. A caller checking item B) must also
 *   reject them, because OPADD 4.1 §2.3.16 allows neither as a start time.
 * - **It needs the window.** A day is real only once its century is known: `0002290000` is valid
 *   with a window from 2000 and not with one from 1900. It is false without `yearWindow`, `PERM`
 *   included.
 * - **Locale-independent**, as the parser is.
 *
 * @param value The value to check
 * @param options The hundred-year window a two-digit year is read in
 * @returns `true` for a real validity value in the window, or `false` on invalid input
 *
 * @example isValidNotamValidity("2506151200", { yearWindow: 2000 }) // true
 * @example isValidNotamValidity("1407031230EST", { yearWindow: 2000 }) // true
 * @example isValidNotamValidity("PERM", { yearWindow: 2000 }) // true
 * @example isValidNotamValidity("1407031230 EST", { yearWindow: 2000 }) // false
 * @example isValidNotamValidity("2502301200", { yearWindow: 2000 }) // false
 * @example isValidNotamValidity("2506151200", {}) // false
 */
export function isValidNotamValidity(
  value: string,
  options: TwoDigitYearOptions,
): boolean {
  return readNotamValidity(value, options) !== null;
}
