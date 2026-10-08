import { isOptionsArgument } from "../../internal";
import { writeEdiDateTime } from "../../internal/ediDateTimeWriter";
import type { TwoDigitYearOptions } from "../../types/two-digit-year";

/**
 * Write an ISO 8601 date, time, date-time or interval as an X12 Date Time Period (data element
 * 1251) in a format qualifier (data element 1250): the inverse of `parseX12DateTimePeriod`.
 *
 * `value` is one ISO 8601 string, and the code fixes which kind. The pair is what a `DTP`
 * segment carries (`DTP-02` and `DTP-03`), and `DTM-05` and `DTM-06`. Codes are release 005010,
 * read from [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/element/1250);
 * the X12 text itself was not reached. The 42-code list is the same in release 008010.
 *
 * ### Supported codes
 * | Code | Mask | `value` is |
 * |---|---|---|
 * | `D8` | `CCYYMMDD` | a date, `YYYY-MM-DD` |
 * | `D6` | `YYMMDD` | a date; needs `yearWindow` |
 * | `DB` | `MMDDCCYY` | a date |
 * | `TT` | `MMDDYY` | a date; needs `yearWindow` |
 * | `DT` | `CCYYMMDDHHMM` | a local date-time, `YYYY-MM-DDTHH:MM[:SS]` |
 * | `TR` | `DDMMYYHHMM` | a local date-time; needs `yearWindow` |
 * | `RTS` | `CCYYMMDDHHMMSS` | a local date-time |
 * | `TM` | `HHMM` | a time, `HH:MM[:SS]` |
 * | `TS` | `HHMMSS` | a time |
 * | `RD8` | `CCYYMMDD-CCYYMMDD` | `<date>/<date>` |
 * | `RD6` | `YYMMDD-YYMMDD` | `<date>/<date>`; needs `yearWindow` |
 * | `RD` | `MMDDCCYY-MMDDCCYY` | `<date>/<date>` |
 * | `RDT` | `CCYYMMDDHHMM-CCYYMMDDHHMM` | `<date-time>/<date-time>` |
 * | `DTS` | `CCYYMMDDHHMMSS-CCYYMMDDHHMMSS` | `<date-time>/<date-time>` |
 * | `DDT` | `CCYYMMDD-CCYYMMDDHHMM` | `<date>/<date-time>` |
 * | `DTD` | `CCYYMMDDHHMM-CCYYMMDD` | `<date-time>/<date>` |
 * | `RTM` | `HHMM-HHMM` | `<time>/<time>` |
 * | `TC` | `DDD` | a date; only its day of the year is written |
 * | `TU` | `YYDDD` | a date; needs `yearWindow` |
 * | `EH` | `YDDD` | a date; only the last digit of its year is written |
 *
 * - **The output is built from the value's fields**, each zero-padded to the width its mask
 *   gives. A range is an ISO 8601 interval, `<start>/<end>`, and is always written with the
 *   hyphen X12 transmits.
 * - **No code carries an offset**, so a value with `Z` or an offset returns `""`: an instant is
 *   not written as a wall clock. Pass the local date-time.
 * - **`D8`, `TM` and `TS` also write the date and time elements of a freight segment.** Element
 *   373 (Date) is `CCYYMMDD` and element 337 (Time) is `HHMM` or `HHMMSS`, the same digits, so
 *   these three codes write what `AT7`, `G62` and `DTM-02`/`03` carry and `parseX12DateTime`
 *   reads back. Element 337 can also hold tenths or hundredths of a second, which no 1250 code
 *   has: they are read by `parseX12DateTime` and not written.
 * - **The value must be the kind the code names.** A date-time under a date code, a date under a
 *   date-time code and a single value under a range code return `""`.
 * - **Nothing is dropped silently.** A code with no seconds field (`DT`, `TR`, `TM`, `RDT`,
 *   `DDT`, `DTD`, `RTM`) returns `""` for a second other than `00`; `:00` may be written or left
 *   out. No code has a field below the second, so a fraction other than zero returns `""`.
 * - **`TC` and `EH` are lossy by definition.** `TC` writes the day of the year and drops the
 *   year; `EH` keeps only the year's last digit. Two dates can share one value, and
 *   `parseX12DateTimePeriod` cannot return the date. `TU` keeps the whole date, and
 *   `parseX12DateTimePeriod` returns it.
 * - **A two-digit year needs `yearWindow`** (`D6`, `TT`, `TR`, `RD6`, `TU`). Those codes return
 *   `""` without a valid window, and for a year outside it: writing 1969 into a 2000–2099 window
 *   would read back as 2069. A two-digit year is a legacy form; write `D8` or `DT` where a
 *   partner accepts it. Codes with a four-digit year never read the option.
 * - **A year outside 0000–9999 returns `""`**, for every code that takes a date.
 * - **A dated range whose end precedes its start returns `""`; a time-only range (`RTM`) may
 *   cross midnight and is written as given.** For a dated range, an end equal to its start is
 *   written, and `DDT` and `DTD` compare by calendar date. `RTM` carries no date, so
 *   `22:00/06:00` is a window from 22:00 to 06:00 the next morning and is written `2200-0600`.
 *   Equal times (`06:00/06:00`) are written too. The value does not say which day either time
 *   falls on.
 * - `UN` (Unstructured) has no mask and returns `""`. So does every 1250 code
 *   `isValidX12DateTimePeriodFormat` rejects.
 * - A bracketed RFC 9557 annotation on a date or date-time is read as `isValidDate` and
 *   `isValidDateTime` read it: a non-ISO calendar returns `""`.
 * - Returns `""` for a value that is not valid ISO 8601 of the kind, a non-string value or code,
 *   and `options` that is not an object.
 *
 * @param value ISO 8601 date, time, local date-time or `<start>/<end>` interval (e.g. "2024-06-15")
 * @param formatQualifier X12 data element 1250 format code (e.g. "D8")
 * @param options The hundred-year window a two-digit year is written from
 * @returns the X12 value, or "" on invalid input or a value the code cannot hold
 *
 * @example formatX12DateTimePeriod("2024-06-15", "D8") // "20240615"
 * @example formatX12DateTimePeriod("2024-06-15", "DB") // "06152024"
 * @example formatX12DateTimePeriod("2024-06-15T14:30", "DT") // "202406151430"
 * @example formatX12DateTimePeriod("2024-06-15T14:30:45", "RTS") // "20240615143045"
 * @example formatX12DateTimePeriod("14:30", "TM") // "1430"
 * @example formatX12DateTimePeriod("2024-06-15/2024-06-20", "RD8") // "20240615-20240620"
 * @example formatX12DateTimePeriod("2024-06-15/2024-06-20T16:00", "DDT") // "20240615-202406201600"
 * @example formatX12DateTimePeriod("09:00/17:00", "RTM") // "0900-1700"
 * @example formatX12DateTimePeriod("22:00/06:00", "RTM") // "2200-0600" (a window that crosses midnight)
 * @example formatX12DateTimePeriod("2024-06-15", "D6", { yearWindow: 2000 }) // "240615"
 * @example formatX12DateTimePeriod("2024-06-14", "TU", { yearWindow: 2000 }) // "24166"
 * @example formatX12DateTimePeriod("2024-06-14", "TC") // "166" (the year is dropped)
 * @example formatX12DateTimePeriod("2024-06-14", "EH") // "4166" (only the year's last digit is kept)
 * @example formatX12DateTimePeriod("2024-06-15", "D6") // "" (two-digit year, no window)
 * @example formatX12DateTimePeriod("1969-01-01", "D6", { yearWindow: 2000 }) // "" (the year is outside the window)
 * @example formatX12DateTimePeriod("2024-06-15T14:30:45", "DT") // "" (DT has no seconds field)
 * @example formatX12DateTimePeriod("2024-06-15T14:30Z", "DT") // "" (no 1250 code carries an offset)
 * @example formatX12DateTimePeriod("2024-06-15T14:30", "D8") // "" (a date-time under a date code)
 * @example formatX12DateTimePeriod("2024-06-20/2024-06-15", "RD8") // "" (the end precedes the start)
 * @example formatX12DateTimePeriod("2024-06-15", "UN") // "" (unstructured: nothing to write)
 * @example formatX12DateTimePeriod("2023-02-29", "D8") // "" (not a real date)
 */
export function formatX12DateTimePeriod(
  value: string,
  formatQualifier: string,
  options?: TwoDigitYearOptions,
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }
    return writeEdiDateTime("x12", formatQualifier, value, options);
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
