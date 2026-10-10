import { ediCodeOf } from "../../internal/ediGrammar";
import type { EdifactDtmFormatClass } from "../../types/edi";

/**
 * Name the kind of value a UN/EDIFACT data element 2379 format code states, and return the code
 * narrowed to that kind, so a code that arrives as data reaches the function that reads it.
 *
 * Each kind has its own parser, formatter and validator, and each takes only its own codes. A
 * generic `DTM` reader holds the code as a plain string: it calls this function, tests `kind`,
 * and passes `format` on. Testing `kind` narrows `format` to that kind's union, so the call
 * needs no cast.
 *
 * ### Kinds
 * | `kind` | Codes | Read by |
 * |---|---|---|
 * | `"date"` | `102` | `parseEdifactDate` |
 * | `"time"` | `401`, `402` | `parseEdifactTime` |
 * | `"dateTime"` | `203`, `204` | `parseEdifactDateTime` |
 * | `"offsetDateTime"` | `205`, `208`, `303`, `304` | `parseEdifactOffsetDateTime` |
 * | `"datePeriod"` | `718` | `parseEdifactDatePeriod` |
 * | `"dateTimePeriod"` | `719` | `parseEdifactDateTimePeriod` |
 *
 * - **The narrowing pattern.** With `const classified = classifyEdifactDtmFormat(code)`, the
 *   line `if (classified?.kind === "date") parseEdifactDate(value, classified.format)` compiles
 *   with no cast: inside the test, `classified.format` is `EdifactDateFormat`.
 * - Both members are always present, and each call returns a new object.
 * - Returns `null` for every code no function reads: the two-digit-year codes (`101`, `201`,
 *   `202`, `206`, `207`, `301`, `302`, `713`, `717`), `209`, `404`, `406` and every other 2379
 *   code.
 * - Matching is exact: `" 203"`, `"0203"` and the number `203` are not codes.
 * - Returns a result exactly when `isValidEdifactDtmFormat` is true.
 *
 * @param format The data element 2379 format code, as it arrives (e.g. "203")
 * @returns `{ kind, format }`, or null on invalid input
 *
 * @example classifyEdifactDtmFormat("102") // { kind: "date", format: "102" }
 * @example classifyEdifactDtmFormat("401") // { kind: "time", format: "401" }
 * @example classifyEdifactDtmFormat("402") // { kind: "time", format: "402" }
 * @example classifyEdifactDtmFormat("203") // { kind: "dateTime", format: "203" }
 * @example classifyEdifactDtmFormat("204") // { kind: "dateTime", format: "204" }
 * @example classifyEdifactDtmFormat("205") // { kind: "offsetDateTime", format: "205" }
 * @example classifyEdifactDtmFormat("208") // { kind: "offsetDateTime", format: "208" }
 * @example classifyEdifactDtmFormat("303") // { kind: "offsetDateTime", format: "303" }
 * @example classifyEdifactDtmFormat("304") // { kind: "offsetDateTime", format: "304" }
 * @example classifyEdifactDtmFormat("718") // { kind: "datePeriod", format: "718" }
 * @example classifyEdifactDtmFormat("719") // { kind: "dateTimePeriod", format: "719" }
 * @example classifyEdifactDtmFormat("101") // null (a two-digit year is not read)
 * @example classifyEdifactDtmFormat("602") // null (not a supported code)
 */
export function classifyEdifactDtmFormat(
  format: string,
): EdifactDtmFormatClass | null {
  const entry = ediCodeOf("edifact", format);
  // The layout table is typed kind by kind from the format unions, so the kind an entry carries
  // is the kind of the union its code belongs to.
  return entry === null
    ? null
    : ({ kind: entry.kind, format } as EdifactDtmFormatClass);
}
