import { X12_DATE_TIME_PERIOD_FORMATS } from "../../internal";
import type { X12DateTimePeriodFormat } from "../../types/edi";

/**
 * Return true when `formatQualifier` is an X12 data element 1250 (Date Time Period Format
 * Qualifier) code that `parseX12DateTimePeriod` and `formatX12DateTimePeriod` name.
 *
 * - Valid codes are `D8`, `D6`, `DB`, `TT`, `DT`, `TR`, `RTS`, `TM`, `TS`, `RD8`, `RD6`, `RD`,
 *   `RDT`, `DTS`, `DDT`, `DTD`, `RTM`, `TC`, `TU`, `EH` and `UN`: the 20 codes GMT reads and
 *   writes, and `UN`. Release 005010, read from
 *   [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the
 *   X12 text itself was not reached. The 42-code list is the same in release 008010.
 * - **`UN` (Unstructured) is a valid format and never a valid value.** It is a real 1250 code,
 *   so this returns true for it. It has no mask, so `parseX12DateTimePeriod` returns `null` and
 *   `isValidX12DateTimePeriod` returns false for every value under it: GMT never guesses a format.
 * - The other 21 codes of the element return false: the partial values (`CC`, `CY`, `CM`, `CQ`,
 *   `YM`, `MD`, `DD`, `MM`, `TQ`, `YY`, `MCY`), the ranges of partial values (`DA`, `RD2`, `RD4`,
 *   `RD5`, `RMD`, `RMY`), `RDM` (`YYMMDD-MMDD`, a range whose end names no year) and the
 *   month-name forms (`CD`, `KA`, `YMM`).
 * - `TS`, `TT`, `CD` and `MD` are codes of data element 623 (Time Code) too, with unrelated
 *   meanings: here `TS` is `HHMMSS` and `TT` is `MMDDYY`, and `CD` and `MD` are not read; there
 *   they name the Atlantic, Central and Mountain zones. Check a time code with
 *   `isValidX12TimeCode`.
 * - Matching is exact: case and spacing are not normalised.
 * - Accepts any input type and returns false for non-string values.
 * - `parseX12DateTimePeriod` returns `null` for an unknown code and for a bad value alike. Check the
 *   code here to tell a code GMT does not read apart from a value that does not fit its code.
 *
 * @param formatQualifier candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidX12DateTimePeriodFormat("D8") // true
 * @example isValidX12DateTimePeriodFormat("RD8") // true
 * @example isValidX12DateTimePeriodFormat("UN") // true (a real code; no value parses under it)
 * @example isValidX12DateTimePeriodFormat("d8") // false (case is exact)
 * @example isValidX12DateTimePeriodFormat("CM") // false (a year and month: a code GMT does not read)
 * @example isValidX12DateTimePeriodFormat("DTM") // false (a segment name, not a 1250 code)
 * @example isValidX12DateTimePeriodFormat(null) // false
 */
export function isValidX12DateTimePeriodFormat(
  formatQualifier: unknown,
): formatQualifier is X12DateTimePeriodFormat {
  return (
    typeof formatQualifier === "string" &&
    X12_DATE_TIME_PERIOD_FORMATS.includes(
      formatQualifier as X12DateTimePeriodFormat,
    )
  );
}
