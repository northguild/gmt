import { readEdiValue, readX12Time } from "../../internal/ediDateTimeFields";
import type { X12TimeFormat } from "../../types/edi";

/**
 * Parse an X12 time as an ISO 8601 time: a data element 337 value with no qualifier, or a time
 * that arrives with a data element 1250 format qualifier.
 *
 * X12 sends a time two ways, and `format` says which the caller holds:
 *
 * - **With no qualifier**: the time element of a freight segment (`AT7-06`, `G62-04`,
 *   `DTM-03`) is data element 337, which fixes its own four forms. Omit `format`.
 * - **With a qualifier**: a `DTP` segment (`DTP-02` and `DTP-03`), and `DTM-05` and `DTM-06`,
 *   send a data element 1250 format qualifier beside the value. Pass it as `format`, and the
 *   value is read against that qualifier's mask alone.
 *
 * Definitions are release 005010, read from Stedi's X12-licensed dictionary
 * ([337](https://www.stedi.com/edi/x12-005010/element/337),
 * [1250](https://www.stedi.com/edi/x12-005010/element/1250)); the X12 text itself was not
 * reached.
 *
 * ### Forms
 * | `format` | Digits | Mask | The dictionary's definition |
 * |---|---|---|---|
 * | omitted | 4, 6, 7 or 8 | `HHMM`, `HHMMSS`, `HHMMSSD`, `HHMMSSDD` | Element 337: "H = hours (00-23), M = minutes (00-59), S = integer seconds (00-59) … D = tenths (0-9) and DD = hundredths (00-99)" |
 * | `TM` | 4 | `HHMM` | "Time Expressed in Format HHMM" |
 * | `TS` | 6 | `HHMMSS` | "Time Expressed in Format HHMMSS" |
 *
 * - **A qualifier is strict.** `"143045"` is a `TS` value and returns `""` under `TM`, and no
 *   1250 code holds decimal seconds, so a 7- or 8-digit value returns `""` under either
 *   qualifier. The same values read when `format` is omitted.
 * - **A `format` that is present and is not `TM` or `TS` returns `""`**, never the unqualified
 *   read: a code of another kind (`D8`), a code that is not read (`RTM`, `TT`), an empty string
 *   and a non-string. Only an omitted or `undefined` format means "no qualifier".
 * - Seconds are always written in the result, `00` for `HHMM`.
 * - With no qualifier, tenths and hundredths become the fraction of the second exactly:
 *   `1430001` is `14:30:00.1` and `14300012` is `14:30:00.12`. A zero fraction is not written
 *   (`14300000` is `14:30:00`).
 * - Fields are checked, not clamped: hour 24, minute 60, second 60 and a value of 5 or 9 digits
 *   return `""`.
 * - **The time is local to a place the value does not name.** In a freight segment the time
 *   code beside it (data element 623) says where the clock was: classify it with
 *   `classifyX12TimeCode`. To read the date and time elements together, use
 *   `parseX12DateAndTime`.
 * - A range of times (`RTM`, `HHMM-HHMM`) is not read.
 * - Returns `""` for a non-string value.
 *
 * @param value The time as transmitted (e.g. "1430")
 * @param format X12 data element 1250 format qualifier the time arrived with; omit it for a data element 337 value
 * @returns the time as `HH:MM:SS`, with a fraction of one or two digits when a 337 value has one, or "" on invalid input
 *
 * @example parseX12Time("1430") // "14:30:00"
 * @example parseX12Time("1430", "TM") // "14:30:00"
 * @example parseX12Time("143045", "TS") // "14:30:45"
 * @example parseX12Time("143045") // "14:30:45"
 * @example parseX12Time("1430001") // "14:30:00.1" (a tenth of a second)
 * @example parseX12Time("14300012") // "14:30:00.12" (hundredths of a second)
 * @example parseX12Time("14300000") // "14:30:00" (a zero fraction is not written)
 * @example parseX12Time("143045", "TM") // "" (six digits is a TS value)
 * @example parseX12Time("14300012", "TS") // "" (no 1250 code holds decimal seconds)
 * @example parseX12Time("2430") // "" (hour 24)
 * @example parseX12Time("14304") // "" (five digits is not an element 337 form)
 * @example parseX12Time("14:30") // "" (the value is the digits of the element)
 */
export function parseX12Time(value: string, format?: X12TimeFormat): string {
  try {
    // No qualifier: the element fixes its own forms. With one, the value is read against that
    // code's mask, and a code that is not a time code is refused there.
    return format === undefined
      ? readX12Time(value)
      : readEdiValue("x12", "time", format, value);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
