import type { TwoDigitYearOptions } from "../../types/two-digit-year";
import { parseEdifactDtm } from "../parse/parseEdifactDtm";

/**
 * Return true when `value` is a UN/EDIFACT `DTM` value (data element 2380) that fits its format
 * code (data element 2379).
 *
 * - True exactly when `parseEdifactDtm` returns a result for the same arguments: the validator
 *   calls the parser, so the two cannot disagree. The grammar of each code is in
 *   `parseEdifactDtm`'s table.
 * - A value is valid only against a code: `"202406151430"` is a `203` value and not a `204` one.
 *   This is why GMT publishes no pattern per code.
 * - Checks the calendar as well as the shape: 31 June, 29 February 2023, an hour 24 or a
 *   second 60 is false.
 * - A period (`713`, `717`, `718`, `719`) is valid in its wire form only, with no hyphen, so a
 *   hyphen is false. Every UNTDID 2379 directory read (twelve, from D.93A to D.22B) says so:
 *   from D.01C `713`, `717` and `718` are "transmitted as consecutive characters without
 *   hyphen", and `719`, in every directory that has it, is "given in actual message without
 *   hyphen". A period whose end precedes its start is false.
 * - A code with a two-digit year (`101`, `201`, `202`, `206`, `207`, `301`, `302`, `713`, `717`)
 *   is false without `options.yearWindow`, and the window decides whether a 29 February exists.
 *   A code with a four-digit year never reads the option.
 * - A `301`–`304` or `404` value whose three zone characters are upper-case letters that name no
 *   offset (`CET`) is valid: the parser returns them as `zone` text. A sign or a digit that is
 *   not a signed hour from `00` to `23` (`+24`, `000`) is false: a broken offset, not a zone
 *   name. Lower case (`cet`) and a lone `Z` (`202406151430Z`) are false too, by GMT's rule:
 *   `parseEdifactDtm` gives the reasons.
 * - Takes the unescaped element value: `"202406151430?+02"` is false.
 * - False for an unsupported code, the same answer as for a bad value; check the code alone
 *   with `isValidEdifactDtmFormat`. False for a non-string value or code, and for an `options`
 *   argument that is not an object.
 *
 * @param value The data element 2380 value, unescaped (e.g. "202406151430")
 * @param formatQualifier The data element 2379 format code (e.g. "203")
 * @param options The century a two-digit year belongs to
 * @returns boolean indicating validity
 *
 * @example isValidEdifactDtm("202406151430", "203") // true
 * @example isValidEdifactDtm("202406151430+02", "303") // true
 * @example isValidEdifactDtm("202406151430CET", "303") // true (zone text the parser returns unread)
 * @example isValidEdifactDtm("202406151430+24", "303") // false (a broken offset, not a zone name)
 * @example isValidEdifactDtm("202406151430Z", "303") // false (a lone Z: the mask has three zone characters)
 * @example isValidEdifactDtm("20240615143045+0200", "208") // true
 * @example isValidEdifactDtm("2024061520240620", "718") // true
 * @example isValidEdifactDtm("20240615-20240620", "718") // false (a period is transmitted without a hyphen)
 * @example isValidEdifactDtm("2024062020240615", "718") // false (the end precedes the start)
 * @example isValidEdifactDtm("240615", "101", { yearWindow: 2000 }) // true
 * @example isValidEdifactDtm("240615", "101") // false (a two-digit year with no window)
 * @example isValidEdifactDtm("20240615", "102", { yearWindow: 1950 }) // true (a four-digit year ignores the window)
 * @example isValidEdifactDtm("20230229", "102") // false (2023 has no 29 February)
 * @example isValidEdifactDtm("202406151430", "204") // false (a 203 value under 204)
 * @example isValidEdifactDtm("2024", "602") // false (an unsupported code)
 * @example isValidEdifactDtm("", "102") // false
 */
export function isValidEdifactDtm(
  value: string,
  formatQualifier: string,
  options?: TwoDigitYearOptions,
): boolean {
  return parseEdifactDtm(value, formatQualifier, options) !== null;
}
