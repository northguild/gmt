import { writeX12TimeElement } from "../../internal/ediDateTimeWriter";
import type { X12TimeElementForm } from "../../types/edi";

/**
 * Write an ISO 8601 time as an X12 data element 337 (Time) value, in the form the caller names
 * by the element's own mask. `parseX12Time` reads the result back when it is given no qualifier.
 *
 * Element 337 is the time element of many X12 segments: in freight, `AT7-06`, `G62-04` and
 * `DTM-03`. No format qualifier travels with it, so nothing in the segment says which of its
 * four forms a value is in. The definition is release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/337); the X12
 * text itself was not reached.
 *
 * ### Forms
 * | Form | Digits | The dictionary's definition |
 * |---|---|---|
 * | `HHMM` | 4 | "H = hours (00-23), M = minutes (00-59)" |
 * | `HHMMSS` | 6 | "S = integer seconds (00-59)" |
 * | `HHMMSSD` | 7 | "D = tenths (0-9)" |
 * | `HHMMSSDD` | 8 | "DD = hundredths (00-99)" |
 *
 * - `value` is a time, as `isValidTime` accepts it: `HH:MM`, with seconds and a fraction of a
 *   second if it has them. A date-time, a date or a time with an offset returns `""`.
 * - **The form alone fixes the digits written.** It is never read off the value, so the width of
 *   the field does not depend on the data: a time with no fraction is `14300000` under
 *   `HHMMSSDD`, and a time with one is `1430` under `HHMM`.
 * - Precision is cut to the mask, never rounded. `D` is the whole tenths of the second and `DD`
 *   its whole hundredths, so `14:30:45.999` is `1430459` under `HHMMSSD` and `14304599` under
 *   `HHMMSSDD`. A written value never names a later second than its input.
 * - **The form is a mask, not a data element 1250 code.** `TM` and `TS` return `""` here. To
 *   write a time that travels with a 1250 qualifier (`DTP-03`, `DTM-06`), use `formatX12Time`.
 * - Returns `""` for any other form and for a non-string argument.
 *
 * @param value ISO 8601 time (e.g. "14:30:00.12")
 * @param form The element 337 mask to write: `HHMM`, `HHMMSS`, `HHMMSSD` or `HHMMSSDD`
 * @returns the X12 time value, or "" on invalid input
 *
 * @example formatX12TimeElement("14:30:00.12", "HHMMSSDD") // "14300012"
 * @example formatX12TimeElement("14:30:00.12", "HHMMSSD") // "1430001" (cut, not rounded)
 * @example formatX12TimeElement("14:30:00", "HHMMSSDD") // "14300000"
 * @example formatX12TimeElement("14:30", "HHMM") // "1430"
 * @example formatX12TimeElement("14:30:45.999", "HHMMSS") // "143045"
 * @example formatX12TimeElement("14:30:45.999", "HHMMSSD") // "1430459" (cut, not rounded)
 * @example formatX12TimeElement("14:30:45", "TS") // "" (a 1250 code is not a mask)
 * @example formatX12TimeElement("2024-06-15T14:30:00", "HHMM") // "" (a date-time is not a time)
 * @example formatX12TimeElement("24:00", "HHMM") // "" (not a real time)
 */
export function formatX12TimeElement(
  value: string,
  form: X12TimeElementForm,
): string {
  try {
    return writeX12TimeElement(form, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
