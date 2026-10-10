import { writeEdiValue } from "../../internal/ediDateTimeWriter";
import type { X12DateFormat } from "../../types/edi";

/**
 * Write an ISO 8601 date as an X12 Date Time Period value (data element 1251) in a date format
 * qualifier (data element 1250). The inverse of `parseX12Date`.
 *
 * Codes are release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached.
 *
 * ### Format codes
 * | Code | Mask | The dictionary's definition |
 * |---|---|---|
 * | `D8` | `CCYYMMDD` | "Date Expressed in Format CCYYMMDD" |
 * | `DB` | `MMDDCCYY` | "Date Expressed in Format MMDDCCYY" |
 *
 * - `value` is a date, as `isValidDate` accepts it. A date-time, an instant or a time returns
 *   `""`, as `formatDate` returns `""` for them: pass the date alone.
 * - Each field is zero-padded to the width the mask gives it.
 * - **`D8` also writes data element 373 (Date)**, the `CCYYMMDD` date element of `AT7`, `G62`
 *   and `DTM-02`.
 * - A year outside 0000–9999 returns `""`: `CCYY` is four digits and no sign.
 * - Returns `""` for any other code, a code of another kind included, and for a non-string
 *   argument.
 *
 * @param value ISO 8601 date (e.g. "2024-06-15")
 * @param format X12 data element 1250 format qualifier
 * @returns the data element 1251 value, or "" on invalid input
 *
 * @example formatX12Date("2024-06-15", "D8") // "20240615"
 * @example formatX12Date("2024-06-15", "DB") // "06152024"
 * @example formatX12Date("2024-06-15T14:30", "D8") // "" (a date-time is not a date)
 * @example formatX12Date("2023-02-29", "D8") // "" (not a real date)
 * @example formatX12Date("2024-06-15", "DT") // "" (a date-time code: use formatX12DateTime)
 */
export function formatX12Date(value: string, format: X12DateFormat): string {
  try {
    return writeEdiValue("x12", "date", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
