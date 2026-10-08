import { parseX12DateTime } from "../parse/parseX12DateTime";

/**
 * Return true when the date, time and time code of an X12 segment are values `parseX12DateTime`
 * reads: element 373 (Date), element 337 (Time) and element 623 (Time Code), as `AT7`, `G62` and
 * `DTM-02`/`03`/`04` carry them.
 *
 * `parseX12DateTime` returns `null` for a bad value, so this is the check to run before it when
 * a segment must be accepted or refused without being read.
 *
 * - True exactly when `parseX12DateTime` returns a non-null result for the same three arguments:
 *   the validator calls the parser, so the two cannot disagree.
 * - A date alone and a time alone are true. `G62` (syntax note R0103, with P0102 and P0304)
 *   and `DTM` (R020305) allow either. `AT7` forbids a time without a date (C0605: "If AT7-06
 *   is present, then AT7-05 is required"), but this function is not told which segment a value
 *   came from, so a time alone is true wherever it came from (GMT's rule).
 * - Neither a date nor a time is false (GMT's rule): there is nothing to read. X12's R020305,
 *   "At least one of DTM-02, DTM-03 or DTM-05 is required", is also met by a `DTM` that carries
 *   only `DTM-05`/`06`; check that pair with `isValidX12DateTimePeriod`.
 * - The date is `CCYYMMDD`. Temporal, with `overflow: "reject"`, proves it is real, so
 *   `20230229` is false.
 * - The time is one of the four element 337 forms: `HHMM`, `HHMMSS`, `HHMMSSD` or `HHMMSSDD`.
 *   Hour 24, minute or second 60 and a value of 5 or 9 digits are false.
 * - The time code is optional and must be one of the element 623 codes `x12TimeCode` reads. A
 *   valid result says the elements can be read, not that they name an instant: `ES` is valid and
 *   names a zone.
 * - A time code with no time is false. It is X12's rule for `DTM` (syntax note C0403, "If
 *   DTM-04 is present, then DTM-03 is required") and for `AT7` (C0706), and GMT's rule for
 *   `G62`, which has no such note.
 * - An element that was not sent is `undefined` or `""`, for each of the three (GMT's rule, not
 *   an X12 statement).
 * - Returns false for an argument that is neither a string nor `undefined`.
 *
 * @param date The element 373 date as transmitted, `CCYYMMDD` (e.g. "20240615"); `undefined` or `""` when not sent
 * @param time The element 337 time as transmitted (e.g. "1430"); `undefined` or `""` when not sent
 * @param timeCode The element 623 time code (e.g. "ET"); `undefined` or `""` when not sent
 * @returns boolean indicating whether `parseX12DateTime` reads the elements
 *
 * @example isValidX12DateTime("20240615", "1430", "ET") // true
 * @example isValidX12DateTime("20240615", "1430") // true (no time code: a local time)
 * @example isValidX12DateTime("20240615") // true (a date alone)
 * @example isValidX12DateTime("20240615", "14300012", "UT") // true (hundredths of a second)
 * @example isValidX12DateTime("20240615", "", "") // true (empty elements were not sent)
 * @example isValidX12DateTime("", "1430") // true (a time alone)
 * @example isValidX12DateTime("", "1430", "UT") // true (a time alone with its time code)
 * @example isValidX12DateTime("", "") // false (neither a date nor a time)
 * @example isValidX12DateTime("", "", "UT") // false (a time code needs a time)
 * @example isValidX12DateTime("20240615", "", "ET") // false (a time code needs a time)
 * @example isValidX12DateTime("20240615", "1430", "EST") // false (not an element 623 code)
 * @example isValidX12DateTime("20240615", "2430") // false (hour 24)
 * @example isValidX12DateTime("20230229", "1430") // false (2023 has no 29 February)
 * @example isValidX12DateTime("240615") // false (the date element has a four-digit year)
 */
export function isValidX12DateTime(
  date?: string,
  time?: string,
  timeCode?: string,
): boolean {
  return parseX12DateTime(date, time, timeCode) !== null;
}
