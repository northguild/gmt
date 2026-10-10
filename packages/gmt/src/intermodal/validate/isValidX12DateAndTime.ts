import { parseX12DateAndTime } from "../parse/parseX12DateAndTime";

/**
 * Return true when the date and the time of an X12 segment, sent as two elements, together
 * state a real local date and time.
 *
 * ### The two elements
 * | Element | Name | The dictionary's definition |
 * |---|---|---|
 * | [373](https://www.stedi.com/edi/x12-005010/element/373) | Date | "Date expressed as CCYYMMDD where CC represents the first two digits of the calendar year" |
 * | [337](https://www.stedi.com/edi/x12-005010/element/337) | Time | "Time expressed in 24-hour clock time as follows: HHMM, or HHMMSS, or HHMMSSD, or HHMMSSDD" |
 *
 * - True exactly when `parseX12DateAndTime` returns a date-time for the same arguments: the
 *   validator calls the parser, so the two cannot disagree.
 * - **Both elements are required.** A missing or empty date or time is false: check a date alone
 *   with `isValidX12Date(value, "D8")` and a time alone with `isValidX12Time`.
 * - Checks the calendar as well as the shape: 29 February 2023, 31 June, hour 24 and minute or
 *   second 60 are false.
 * - The date has a four-digit year and the time is 4, 6, 7 or 8 digits: a date of six digits and
 *   a time of 5 or 9 digits are false.
 * - False for a non-string argument.
 *
 * @param date The data element 373 date as transmitted, `CCYYMMDD` (e.g. "20240615")
 * @param time The data element 337 time as transmitted (e.g. "1430")
 * @returns boolean indicating validity
 *
 * @example isValidX12DateAndTime("20240615", "1430") // true
 * @example isValidX12DateAndTime("20240615", "14300012") // true (hundredths of a second)
 * @example isValidX12DateAndTime("20240615", "") // false (both elements are required)
 * @example isValidX12DateAndTime("20230229", "1430") // false (2023 has no 29 February)
 * @example isValidX12DateAndTime("20240615", "2430") // false (hour 24)
 * @example isValidX12DateAndTime("240615", "1430") // false (the date element has a four-digit year)
 */
export function isValidX12DateAndTime(date: string, time: string): boolean {
  return parseX12DateAndTime(date, time) !== "";
}
