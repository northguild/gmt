import { isOptionsArgument } from "../../internal";
import { readEdiDateTime } from "../../internal/ediDateTimeFields";
import type { EdiDateTime } from "../../types/edi";
import type { TwoDigitYearOptions } from "../../types/two-digit-year";

/**
 * Parse an X12 Date Time Period (data element 1251) against its format qualifier (data element
 * 1250).
 *
 * Data element 1251 holds a date, a time or a range as a run of digits, and data element 1250
 * (Date Time Period Format Qualifier) is the code beside it that says how they are laid out. The
 * pair appears in a `DTP` segment (`DTP-02` and `DTP-03`, after the 374 date/time qualifier) and
 * in `DTM-05` and `DTM-06`. It is one code list wherever it appears, in a freight transaction
 * set and in a healthcare one. Each code fills only the members of the result it can state.
 * Codes are release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250); the X12
 * text itself was not reached. The 42-code list is the same in release 008010.
 *
 * ### Supported codes
 * | Code | Mask | The result holds |
 * |---|---|---|
 * | `D8` | `CCYYMMDD` | `date` |
 * | `D6` | `YYMMDD` | `date`; needs `yearWindow` |
 * | `DB` | `MMDDCCYY` | `date` |
 * | `TT` | `MMDDYY` | `date`; needs `yearWindow` |
 * | `DT` | `CCYYMMDDHHMM` | `local` |
 * | `TR` | `DDMMYYHHMM` | `local`; needs `yearWindow` |
 * | `RTS` | `CCYYMMDDHHMMSS` | `local` |
 * | `TM` | `HHMM` | `time` |
 * | `TS` | `HHMMSS` | `time` |
 * | `RD8` | `CCYYMMDD-CCYYMMDD` | `date` and `periodEnd.date` |
 * | `RD6` | `YYMMDD-YYMMDD` | `date` and `periodEnd.date`; needs `yearWindow` |
 * | `RD` | `MMDDCCYY-MMDDCCYY` | `date` and `periodEnd.date` |
 * | `RDT` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | `local` and `periodEnd.local` |
 * | `DTS` | `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS` | `local` and `periodEnd.local` |
 * | `DDT` | `CCYYMMDD-CCYYMMDDHHMM` | `date` and `periodEnd.local` |
 * | `DTD` | `CCYYMMDDHHMM-CCYYMMDD` | `local` and `periodEnd.date` |
 * | `RTM` | `HHMM-HHMM` | `time` and `periodEnd.time` |
 * | `TC` | `DDD` | `dayOfYear` |
 * | `TU` | `YYDDD` | `date` and `dayOfYear`; needs `yearWindow` |
 * | `EH` | `YDDD` | `yearDigit` and `dayOfYear` |
 * | `UN` | none (unstructured) | nothing: always `null` |
 *
 * - **No code carries an offset.** A date-time comes back as `local`, never as an instant, and
 *   is not read as UTC. Resolve `local` in the IANA zone of the place it belongs to with
 *   `resolveLocal`.
 * - **This is not the date, time and time code of a freight segment.** `AT7`, `G62` and
 *   `DTM-02`/`03`/`04` carry a date (element 373), a time (element 337) and a time code (element
 *   623) as three elements with no 1250 qualifier; a 214 shipment status has no 1250 element at
 *   all. Read those with `parseX12DateTime`. In `DTM`, the time code in `DTM-04` belongs to the
 *   time in `DTM-03` (syntax note C0403), not to the 1250 and 1251 pair in `DTM-05` and `DTM-06`.
 * - **A date is `date`, not `local`.** A date alone names no instant in any zone.
 * - **A range is transmitted with its hyphen**, unlike a UN/EDIFACT period, and the form without
 *   it returns `null`. The start fills the result and the end fills `periodEnd`.
 * - **`RTS` is one date-time despite the `R`, and `DTS` is a range despite having none.**
 * - **A dated range whose end precedes its start returns `null`; a time-only range (`RTM`) may
 *   cross midnight and is returned as given.** For a dated range, an end equal to its start is
 *   accepted, and `DDT` and `DTD` compare a date with a date-time by calendar date. `RTM`
 *   carries no date, so `2200-0600` is a window from 22:00 to 06:00 the next morning: the result
 *   is `time: "22:00:00"` and `periodEnd.time: "06:00:00"`. Equal times (`0600-0600`) are
 *   returned too. The value does not say which day either time falls on.
 * - **`TC` is a day of the year with no year**, 1 to 366, and returns `{ dayOfYear }`. The year
 *   comes from the caller, so day 366 is not checked against one.
 * - **`TU` is a date.** X12 calls it "Date Expressed in Format YYDDD": a year and a day of the
 *   year name one date, so the result is that `date` beside `dayOfYear`. It needs `yearWindow`,
 *   and day 366 of a year with 365 days returns `null`.
 * - **`EH` is the last digit of the year and a day of the year.** One digit names no year, so
 *   the result is `yearDigit` and `dayOfYear` and is never resolved to a date.
 * - **`UN` returns `null` by definition.** It has no mask, and GMT never guesses a format.
 * - **A two-digit year needs `yearWindow`** (`D6`, `TT`, `TR`, `RD6`, `TU`): without a valid
 *   window those codes return `null`. A two-digit year is a legacy form; ask a partner for `D8`
 *   or `DT`. Codes with a four-digit year never read the option.
 * - A field out of range, a day its month does not have and second `60` return `null`: the mask
 *   proves the shape and Temporal, with `overflow: "reject"`, proves the date is real.
 * - Healthcare uses the same element: 837 and 834 `DTP` segments carry `D8` and `RD8`.
 * - The other 21 codes of the element return `null`: the partial values (`CC`, `CY`, `CM`, `CQ`,
 *   `YM`, `MD`, `DD`, `MM`, `TQ`, `YY`, `MCY`), the ranges of partial values (`DA`, `RD2`, `RD4`,
 *   `RD5`, `RMD`, `RMY`), `RDM` (`YYMMDD-MMDD`, a range whose end names no year) and the
 *   month-name forms (`CD`, `KA`, `YMM`). `DTM` is a segment name, not a code. `TS`, `TT`, `CD`
 *   and `MD` are also data element 623 time codes, with unrelated meanings there. Use
 *   `isValidX12DateTimePeriodFormat` to tell an unread code from a bad value.
 * - Returns `null` for a non-string value or code, and for `options` that is not an object.
 *
 * @param value The element value as transmitted (e.g. "20240615")
 * @param formatQualifier X12 data element 1250 format code (e.g. "D8")
 * @param options The hundred-year window a two-digit year resolves in
 * @returns the members the value states, or null on invalid input
 *
 * @example parseX12DateTimePeriod("20240615", "D8") // { date: "2024-06-15" }
 * @example parseX12DateTimePeriod("06152024", "DB") // { date: "2024-06-15" }
 * @example parseX12DateTimePeriod("202406151430", "DT") // { local: "2024-06-15T14:30:00" } (no offset: not UTC)
 * @example parseX12DateTimePeriod("20240615143000", "RTS") // { local: "2024-06-15T14:30:00" } (one date-time, not a range)
 * @example parseX12DateTimePeriod("1430", "TM") // { time: "14:30:00" }
 * @example parseX12DateTimePeriod("20240615-20240620", "RD8") // { date: "2024-06-15", periodEnd: { date: "2024-06-20" } }
 * @example parseX12DateTimePeriod("20240615-202406201600", "DDT") // { date: "2024-06-15", periodEnd: { local: "2024-06-20T16:00:00" } }
 * @example parseX12DateTimePeriod("0900-1700", "RTM") // { time: "09:00:00", periodEnd: { time: "17:00:00" } }
 * @example parseX12DateTimePeriod("2200-0600", "RTM") // { time: "22:00:00", periodEnd: { time: "06:00:00" } } (a window that crosses midnight)
 * @example parseX12DateTimePeriod("166", "TC") // { dayOfYear: 166 }
 * @example parseX12DateTimePeriod("24366", "TU", { yearWindow: 2000 }) // { date: "2024-12-31", dayOfYear: 366 }
 * @example parseX12DateTimePeriod("4166", "EH") // { yearDigit: 4, dayOfYear: 166 }
 * @example parseX12DateTimePeriod("240615", "D6", { yearWindow: 2000 }) // { date: "2024-06-15" }
 * @example parseX12DateTimePeriod("990615", "D6", { yearWindow: 1950 }) // { date: "1999-06-15" }
 * @example parseX12DateTimePeriod("240615", "D6", { yearWindow: "rolling" }) // { date: "2024-06-15" } (while the current UTC year is 1975–2074)
 * @example parseX12DateTimePeriod("240615", "D6") // null (two-digit year, no window)
 * @example parseX12DateTimePeriod("23366", "TU", { yearWindow: 2000 }) // null (2023 has 365 days)
 * @example parseX12DateTimePeriod("2024061520240620", "RD8") // null (X12 transmits the hyphen)
 * @example parseX12DateTimePeriod("20240620-20240615", "RD8") // null (the end precedes the start)
 * @example parseX12DateTimePeriod("20230229", "D8") // null (not a real date)
 * @example parseX12DateTimePeriod("20240615", "UN") // null (unstructured: never guessed)
 * @example parseX12DateTimePeriod("202406", "CM") // null (a code GMT does not read)
 */
export function parseX12DateTimePeriod(
  value: string,
  formatQualifier: string,
  options?: TwoDigitYearOptions,
): EdiDateTime | null {
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }
    return readEdiDateTime("x12", formatQualifier, value, options);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
