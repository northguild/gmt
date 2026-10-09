import { X12_DATE_TIME_PERIOD_FORMATS } from "../../internal";
import type { X12DateTimePeriodFormat } from "../../types/edi";

/**
 * Return true when `format` is an X12 data element 1250 (Date Time Period Format Qualifier) code
 * that the X12 functions read and write.
 *
 * - The 10 supported codes are `D8`, `DB` (a date); `TM`, `TS` (a time); `DT`, `RTS` (a date and
 *   time); `RD8`, `RD` (a range of dates) and `RDT`, `DTS` (a range of date-times).
 *   `classifyX12DateTimePeriodFormat` names the kind of a code, and each kind has its own
 *   parser, formatter and validator. Release 005010, read from
 *   [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the
 *   X12 text itself was not reached. The 42-code list is the same in release 008010.
 * - A code with a two-digit year returns false: `D6`, `TT`, `TR`, `RD6` and `TU`. X12 does not
 *   say which century `YY` belongs to; read such a value with `parseDateWithPattern` or
 *   `parseDateTimeWithPattern`, a `yy` pattern and its `yearWindow` option.
 * - `TC` and `EH` (a day of the year with no whole year), `DDT` and `DTD` (a range with a date on
 *   one side and a date-time on the other), `RTM` (a range of times with no date) and `UN`
 *   (Unstructured) return false: none states a value of one kind.
 * - The other 21 codes of the element return false: the partial values (`CC`, `CY`, `CM`, `CQ`,
 *   `YM`, `MD`, `DD`, `MM`, `TQ`, `YY`, `MCY`), the ranges of partial values (`DA`, `RD2`, `RD4`,
 *   `RD5`, `RMD`, `RMY`), `RDM` (`YYMMDD-MMDD`, a range whose end names no year) and the
 *   month-name forms (`CD`, `KA`, `YMM`).
 * - `TS`, `TT`, `CD` and `MD` are codes of data element 623 (Time Code) too, with unrelated
 *   meanings: here `TS` is `HHMMSS`, and `TT`, `CD` and `MD` are not read; there they name the
 *   Atlantic, Central and Mountain zones. Check a time code with `isValidX12TimeCode`.
 * - Matching is exact: case and spacing are not normalised.
 * - Accepts any input type and returns false for non-string values.
 * - A parser returns its sentinel for a code it does not read and for a bad value alike. Check
 *   the code here to tell a code GMT does not read apart from a value that does not fit its
 *   code.
 *
 * @param format candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidX12DateTimePeriodFormat("D8") // true
 * @example isValidX12DateTimePeriodFormat("RD8") // true
 * @example isValidX12DateTimePeriodFormat("D6") // false (a two-digit year: not read)
 * @example isValidX12DateTimePeriodFormat("UN") // false (unstructured: nothing to read)
 * @example isValidX12DateTimePeriodFormat("d8") // false (case is exact)
 * @example isValidX12DateTimePeriodFormat("CM") // false (a year and month: a code GMT does not read)
 * @example isValidX12DateTimePeriodFormat("DTM") // false (a segment name, not a 1250 code)
 * @example isValidX12DateTimePeriodFormat(null) // false
 */
export function isValidX12DateTimePeriodFormat(
  format: unknown,
): format is X12DateTimePeriodFormat {
  return (
    typeof format === "string" &&
    X12_DATE_TIME_PERIOD_FORMATS.includes(format as X12DateTimePeriodFormat)
  );
}
