import { ediCodeOf } from "../../internal/ediGrammar";
import type { X12DateTimePeriodFormatClass } from "../../types/edi";

/**
 * Name the kind of value an X12 data element 1250 format qualifier states, and return the code
 * narrowed to that kind, so a code that arrives as data reaches the function that reads it.
 *
 * Each kind has its own parser, formatter and validator, and each takes only its own codes. A
 * generic `DTP` reader holds `DTP-02` as a plain string: it calls this function, tests `kind`,
 * and passes `format` on. Testing `kind` narrows `format` to that kind's union, so the call
 * needs no cast. Codes are release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * ### Kinds
 * | `kind` | Codes | Read by |
 * |---|---|---|
 * | `"date"` | `D8`, `DB` | `parseX12Date` |
 * | `"time"` | `TM`, `TS` | `parseX12Time(value, format)` |
 * | `"dateTime"` | `DT`, `RTS` | `parseX12DateTime` |
 * | `"dateRange"` | `RD8`, `RD` | `parseX12DateRange` |
 * | `"dateTimeRange"` | `RDT`, `DTS` | `parseX12DateTimeRange` |
 *
 * - **The narrowing pattern.** With `const classified = classifyX12DateTimePeriodFormat(code)`,
 *   the line `if (classified?.kind === "date") parseX12Date(value, classified.format)` compiles
 *   with no cast: inside the test, `classified.format` is `X12DateFormat`.
 * - Both members are always present, and each call returns a new object.
 * - `RTS` is one date-time despite its `R`, and `DTS` is a range despite having none.
 * - Returns `null` for every code no function reads: the two-digit-year codes (`D6`, `TT`, `TR`,
 *   `RD6`, `TU`), `TC`, `EH`, `DDT`, `DTD`, `RTM`, `UN` and every other 1250 code.
 * - This is a format qualifier, not a time code: `TS` here is the format `HHMMSS`. Classify a
 *   data element 623 time code with `classifyX12TimeCode`.
 * - Matching is exact: `"d8"` and `" D8"` are not codes.
 * - Returns a result exactly when `isValidX12DateTimePeriodFormat` is true.
 *
 * @param format X12 data element 1250 format qualifier, as it arrives (e.g. "D8")
 * @returns `{ kind, format }`, or null on invalid input
 *
 * @example classifyX12DateTimePeriodFormat("D8") // { kind: "date", format: "D8" }
 * @example classifyX12DateTimePeriodFormat("DB") // { kind: "date", format: "DB" }
 * @example classifyX12DateTimePeriodFormat("TM") // { kind: "time", format: "TM" }
 * @example classifyX12DateTimePeriodFormat("TS") // { kind: "time", format: "TS" }
 * @example classifyX12DateTimePeriodFormat("DT") // { kind: "dateTime", format: "DT" }
 * @example classifyX12DateTimePeriodFormat("RTS") // { kind: "dateTime", format: "RTS" }
 * @example classifyX12DateTimePeriodFormat("RD8") // { kind: "dateRange", format: "RD8" }
 * @example classifyX12DateTimePeriodFormat("RD") // { kind: "dateRange", format: "RD" }
 * @example classifyX12DateTimePeriodFormat("RDT") // { kind: "dateTimeRange", format: "RDT" }
 * @example classifyX12DateTimePeriodFormat("DTS") // { kind: "dateTimeRange", format: "DTS" }
 * @example classifyX12DateTimePeriodFormat("D6") // null (a two-digit year is not read)
 * @example classifyX12DateTimePeriodFormat("UN") // null (unstructured: nothing to read)
 */
export function classifyX12DateTimePeriodFormat(
  format: string,
): X12DateTimePeriodFormatClass | null {
  const entry = ediCodeOf("x12", format);
  // The layout table is typed kind by kind from the format unions, so the kind an entry carries
  // is the kind of the union its code belongs to.
  return entry === null
    ? null
    : ({ kind: entry.kind, format } as X12DateTimePeriodFormatClass);
}
