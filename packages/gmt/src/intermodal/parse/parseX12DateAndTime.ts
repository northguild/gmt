import { readX12DateAndTime } from "../../internal/ediDateTimeFields";

/**
 * Read the date and the time of an X12 segment, sent as two elements, as one ISO 8601 local
 * date-time.
 *
 * X12 freight segments carry a moment as separate elements, and this function takes the two as
 * they are transmitted: `AT7-05` and `AT7-06` (in a 214 shipment status), `G62-02` and `G62-04`
 * (a 204 load tender) and `DTM-02` and `DTM-03`. Definitions are release 005010, read from
 * [Stedi's X12-licensed dictionary](https://www.stedi.com/edi/x12-005010/segment/DTM); the X12
 * text itself was not reached.
 *
 * ### The two elements
 * | Element | Name | The dictionary's definition |
 * |---|---|---|
 * | [373](https://www.stedi.com/edi/x12-005010/element/373) | Date | "Date expressed as CCYYMMDD where CC represents the first two digits of the calendar year" |
 * | [337](https://www.stedi.com/edi/x12-005010/element/337) | Time | "Time expressed in 24-hour clock time as follows: HHMM, or HHMMSS, or HHMMSSD, or HHMMSSDD" |
 *
 * - **The result is local, never UTC.** It has no `Z` and no offset. `AT7` says what a blank
 *   time code means: "If AT707 is not present then AT706 represents local time of the status".
 *   Reading the value as UTC is the most common EDI timestamp bug.
 * - **The time code beside them (data element 623) says where the clock was.** For a code that
 *   states an offset, resolve the result at that offset:
 *   `resolveLocal(parseX12DateAndTime("20240615", "1430"), x12TimeCodeOffset("20"))` is
 *   `"2024-06-15T19:30:00Z"`. For a code that names a zone (`x12TimeCodeZone`), pass the result
 *   and the IANA zone you map the name to, to `resolveLocal`.
 * - **Both elements are required.** A missing or empty date or time returns `""`: read a date
 *   alone with `parseX12Date(value, "D8")` and a time alone with `parseX12Time`.
 * - The time is one of the four element 337 forms, 4, 6, 7 or 8 digits. Seconds are always
 *   written, `00` for `HHMM`. Tenths and hundredths become the fraction of the second exactly:
 *   `14300012` is `14:30:00.12`. A zero fraction is not written.
 * - **To write the two elements back**, write the date with `formatX12Date(date, "D8")` and the
 *   time with `formatX12TimeElement`, naming the element 337 form by its mask:
 *   `formatX12TimeElement("14:30:00.12", "HHMMSSDD")` is `14300012`.
 * - Fields are checked, not clamped: 29 February 2023, 31 June, hour 24, minute or second 60
 *   and a time of 5 or 9 digits return `""`.
 * - The date has a four-digit year. Before release 004010, element 373 was `YYMMDD`: read such
 *   a date with `parseDateWithPattern("240615", "yyMMdd", undefined, { yearWindow: 2000 })`.
 * - Returns `""` for a non-string argument.
 *
 * @param date The data element 373 date as transmitted, `CCYYMMDD` (e.g. "20240615")
 * @param time The data element 337 time as transmitted (e.g. "1430")
 * @returns the local date-time as `YYYY-MM-DDTHH:MM:SS`, with a fraction when the time has one, or "" on invalid input
 *
 * @example parseX12DateAndTime("20240615", "1430") // "2024-06-15T14:30:00"
 * @example parseX12DateAndTime("20240615", "143045") // "2024-06-15T14:30:45"
 * @example parseX12DateAndTime("20240615", "14300012") // "2024-06-15T14:30:00.12" (hundredths of a second)
 * @example parseX12DateAndTime("20240615", "") // "" (both elements are required)
 * @example parseX12DateAndTime("", "1430") // "" (both elements are required)
 * @example parseX12DateAndTime("20230229", "1430") // "" (2023 has no 29 February)
 * @example parseX12DateAndTime("20240615", "2430") // "" (hour 24)
 * @example parseX12DateAndTime("240615", "1430") // "" (the date element has a four-digit year)
 */
export function parseX12DateAndTime(date: string, time: string): string {
  try {
    return readX12DateAndTime(date, time);
  } catch {
    // Never throws (Core Rule 3): a hostile argument is invalid input, not an exception.
    return "";
  }
}
