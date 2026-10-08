import type { TwoDigitYearOptions } from "../../types/two-digit-year";
import { parseX12DateTimePeriod } from "../parse/parseX12DateTimePeriod";

/**
 * Return true when `value` is an X12 Date Time Period (data element 1251) that
 * `parseX12DateTimePeriod` reads under the format qualifier (data element 1250) `formatQualifier`.
 *
 * `parseX12DateTimePeriod` returns `null` for a bad value, so this is the check to run before it
 * when a value must be accepted or refused without being read. For the date, time and time code
 * of a freight segment (`AT7`, `G62`, `DTM-02`/`03`/`04`), use `isValidX12DateTime`.
 *
 * - True exactly when `parseX12DateTimePeriod` returns a non-null result for the same three
 *   arguments: the validator calls the parser, so the two cannot disagree.
 * - A value is valid only against a code: `20240615` is valid under `D8` and not under `D6`,
 *   `DB` or `RD8`. The mask proves the shape, and Temporal, with `overflow: "reject"`, proves the
 *   date is real, so `20230229` under `D8` is false.
 * - A range needs its hyphen. A dated range whose end precedes its start is false. A time-only
 *   range (`RTM`) carries no date, so it may cross midnight and is valid as given: `2200-0600`
 *   is a window from 22:00 to 06:00 the next morning.
 * - A code with a two-digit year (`D6`, `TT`, `TR`, `RD6`, `TU`) is false without a valid
 *   `yearWindow`. With `yearWindow: "rolling"` the answer depends on the current year.
 * - `UN` (Unstructured) is a valid format and no value is valid under it.
 * - A code GMT does not read is false for every value. Check the code alone with
 *   `isValidX12DateTimePeriodFormat` to tell an unread code from a bad value.
 * - Returns false for a non-string value or code, and for `options` that is not an object.
 *
 * @param value The element value as transmitted (e.g. "20240615")
 * @param formatQualifier X12 data element 1250 format code (e.g. "D8")
 * @param options The hundred-year window a two-digit year resolves in
 * @returns boolean indicating whether `parseX12DateTimePeriod` reads the value
 *
 * @example isValidX12DateTimePeriod("20240615", "D8") // true
 * @example isValidX12DateTimePeriod("20240615-20240620", "RD8") // true
 * @example isValidX12DateTimePeriod("2200-0600", "RTM") // true (a window that crosses midnight)
 * @example isValidX12DateTimePeriod("166", "TC") // true
 * @example isValidX12DateTimePeriod("240615", "D6", { yearWindow: 2000 }) // true
 * @example isValidX12DateTimePeriod("240615", "D6") // false (two-digit year, no window)
 * @example isValidX12DateTimePeriod("20230229", "D8") // false (not a real date)
 * @example isValidX12DateTimePeriod("2024061520240620", "RD8") // false (X12 transmits the hyphen)
 * @example isValidX12DateTimePeriod("20240620-20240615", "RD8") // false (the end precedes the start)
 * @example isValidX12DateTimePeriod("20240615", "UN") // false (unstructured: never guessed)
 * @example isValidX12DateTimePeriod("202406", "CM") // false (a code GMT does not read)
 */
export function isValidX12DateTimePeriod(
  value: string,
  formatQualifier: string,
  options?: TwoDigitYearOptions,
): boolean {
  return parseX12DateTimePeriod(value, formatQualifier, options) !== null;
}
