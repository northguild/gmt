import type {
  X12OffsetTimeCode,
  X12TimeCodeClass,
  X12ZoneTimeCode,
} from "../../types/edi";
import { x12TimeCodeOffset } from "./x12TimeCodeOffset";
import { x12TimeCodeZone } from "./x12TimeCodeZone";

/**
 * Say whether an X12 time code (data element 623) states an offset or names a zone, and return
 * the code narrowed to the function that reads it.
 *
 * Data element 623 is the code beside the date and time of an X12 `AT7`, `G62` or `DTM`
 * segment. 31 of its 56 codes state an offset from UTC and 25 name a zone, and each group has
 * its own reader. A segment reader holds the code as a plain string: it calls this function,
 * tests `kind`, and passes `timeCode` on. Testing `kind` narrows `timeCode` to that reader's
 * union, so the call needs no cast. Codes are release 008010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-008010/element/623); the X12
 * text itself was not reached.
 *
 * ### Kinds
 * | `kind` | Codes | Read by |
 * |---|---|---|
 * | `"offset"` | `01`–`29`, `UT`, `GM` | `x12TimeCodeOffset` |
 * | `"zone"` | `AD`, `AS`, `AT`, `CD`, `CS`, `CT`, `ED`, `ES`, `ET`, `HD`, `HS`, `HT`, `MD`, `MS`, `MT`, `ND`, `NS`, `NT`, `PD`, `PS`, `PT`, `TD`, `TS`, `TT`, `LT` | `x12TimeCodeZone` |
 *
 * - **The narrowing pattern.** With `const classified = classifyX12TimeCode(code)`, the line
 *   `if (classified?.kind === "offset") x12TimeCodeOffset(classified.timeCode)` compiles with
 *   no cast: inside the test, `classified.timeCode` is `X12OffsetTimeCode`. The `"zone"` branch
 *   passes `classified.timeCode` to `x12TimeCodeZone` the same way.
 * - Both members are always present, and each call returns a new object.
 * - `GM` ("Greenwich Mean Time") is an offset code: GMT reads it as `+00:00`, as
 *   `x12TimeCodeOffset` explains.
 * - `25`–`29` were added in release 006010. The function takes no release, so it reads them.
 * - This is a time code, not a format qualifier: `TS` here is Atlantic Standard Time. Classify
 *   a data element 1250 code with `classifyX12DateTimePeriodFormat`.
 * - Matching is exact: two characters, upper case, no padding.
 * - Returns `null` for a code that is not one of the 56 and for a non-string. It returns a
 *   result exactly when `isValidX12TimeCode` is true.
 *
 * @param timeCode X12 data element 623 time code, as it arrives (e.g. "20")
 * @returns `{ kind, timeCode }`, or null on invalid input
 *
 * @example classifyX12TimeCode("20") // { kind: "offset", timeCode: "20" }
 * @example classifyX12TimeCode("UT") // { kind: "offset", timeCode: "UT" }
 * @example classifyX12TimeCode("GM") // { kind: "offset", timeCode: "GM" }
 * @example classifyX12TimeCode("ES") // { kind: "zone", timeCode: "ES" }
 * @example classifyX12TimeCode("ET") // { kind: "zone", timeCode: "ET" }
 * @example classifyX12TimeCode("LT") // { kind: "zone", timeCode: "LT" }
 * @example classifyX12TimeCode("EST") // null (not a 623 code)
 * @example classifyX12TimeCode("et") // null (matching is exact)
 */
export function classifyX12TimeCode(timeCode: string): X12TimeCodeClass | null {
  // Each reader owns the list of its codes and returns its sentinel for any other value, so a
  // code is an offset code exactly when the offset reader reads it.
  if (x12TimeCodeOffset(timeCode as X12OffsetTimeCode) !== "") {
    return { kind: "offset", timeCode: timeCode as X12OffsetTimeCode };
  }
  if (x12TimeCodeZone(timeCode as X12ZoneTimeCode) !== null) {
    return { kind: "zone", timeCode: timeCode as X12ZoneTimeCode };
  }
  return null;
}
