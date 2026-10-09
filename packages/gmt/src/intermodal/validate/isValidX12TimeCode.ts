import { X12_TIME_CODES } from "../../internal";
import type { X12TimeCode } from "../../types/edi";

/**
 * Return true when `timeCode` is one of the 56 X12 data element 623 time codes, the codes
 * `x12TimeCodeOffset` and `x12TimeCodeZone` read between them.
 *
 * - The codes are `01`–`29`, `GM`, `UT`, `LT` and the named zone codes (`AD`, `AS`, `AT`, `CD`,
 *   `CS`, `CT`, `ED`, `ES`, `ET`, `HD`, `HS`, `HT`, `MD`, `MS`, `MT`, `ND`, `NS`, `NT`, `PD`,
 *   `PS`, `PT`, `TD`, `TS`, `TT`), release 008010, read from
 *   [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-008010/element/623); the X12
 *   text itself was not reached.
 * - **The function takes no release, so it accepts the superset.**
 *   [Release 005010](https://www.stedi.com/edi/x12-005010/element/623) has 51 of the codes:
 *   `25`–`29` were added in release 006010 and are not valid in an 004010 or 005010 interchange,
 *   although this returns true for them.
 * - `TS`, `TT`, `CD` and `MD` are codes of data element 1250 too, with unrelated meanings there.
 *   True here says the value is a time code; check a format qualifier with
 *   `isValidX12DateTimePeriodFormat`.
 * - Membership is by the list, never by shape: `00` and `30` are two digits and are not codes.
 * - Matching is exact: two characters, upper case, no padding.
 * - Accepts any input type and returns false for non-string values.
 * - True exactly when one of `x12TimeCodeOffset` and `x12TimeCodeZone` returns a value: the 31
 *   codes that state an offset and the 25 that name a zone are the 56. A valid code says the
 *   value is in the list, not that it carries an offset: `ES` is valid and names a zone.
 *   `classifyX12TimeCode` says which of the two a code is, and narrows it for that reader.
 *
 * @param timeCode candidate value of any type
 * @returns boolean indicating validity
 *
 * @example isValidX12TimeCode("ES") // true
 * @example isValidX12TimeCode("13") // true
 * @example isValidX12TimeCode("LT") // true
 * @example isValidX12TimeCode("27") // true (in release 006010 and later)
 * @example isValidX12TimeCode("et") // false (case is exact)
 * @example isValidX12TimeCode("30") // false (not a 623 code)
 * @example isValidX12TimeCode("EST") // false (an abbreviation, not a 623 code)
 * @example isValidX12TimeCode(null) // false
 */
export function isValidX12TimeCode(timeCode: unknown): timeCode is X12TimeCode {
  return (
    typeof timeCode === "string" &&
    X12_TIME_CODES.includes(timeCode as X12TimeCode)
  );
}
