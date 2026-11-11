/**
 * The SWIFT value-date rows the parse and validate tests share, written by hand from SWIFT
 * _Message Format Validation Rules_ (Nov 2006) Part II §4.1 (`<DATE2>` `YYMMDD`) and §4.1.1
 * (century and the 1980 to 2060 range), never read from the code under test.
 */

/** A value that reads as a date, and the ISO date it reads as. */
export interface SwiftValidRow {
  readonly value: string;
  readonly expected: string;
}

/** A value that reads as no date, and why. */
export interface SwiftSentinelRow {
  readonly value: string;
  readonly reason: string;
}

export const SWIFT_VALID_ROWS: readonly SwiftValidRow[] = [
  { value: "240615", expected: "2024-06-15" },
  { value: "990615", expected: "1999-06-15" },
  { value: "800101", expected: "1980-01-01" },
  { value: "601231", expected: "2060-12-31" },
  { value: "000101", expected: "2000-01-01" },
  { value: "000229", expected: "2000-02-29" },
  { value: "840229", expected: "1984-02-29" },
  { value: "800229", expected: "1980-02-29" },
  { value: "600229", expected: "2060-02-29" },
  { value: "951218", expected: "1995-12-18" },
  { value: "020103", expected: "2002-01-03" },
  { value: "240131", expected: "2024-01-31" },
  { value: "240430", expected: "2024-04-30" },
  { value: "241231", expected: "2024-12-31" },
];

export const SWIFT_SENTINEL_ROWS: readonly SwiftSentinelRow[] = [
  { value: "610101", reason: "2061 > 2060 (T50)" },
  { value: "750101", reason: "2075 > 2060 (T50)" },
  { value: "790101", reason: "2079 > 2060 (T50)" },
  { value: "611231", reason: "first T50 YY at year end" },
  { value: "791231", reason: "last T50 YY at year end" },
  { value: "850229", reason: "1985 is not a leap year" },
  { value: "000230", reason: "no 30 February in 2000" },
  { value: "990229", reason: "1999 is not a leap year" },
  { value: "240631", reason: "June has 30 days" },
  { value: "240931", reason: "September has 30 days" },
  { value: "240001", reason: "month 00" },
  { value: "241315", reason: "month 13" },
  { value: "249915", reason: "month 99" },
  { value: "240600", reason: "day 00" },
  { value: "240632", reason: "day 32" },
  { value: "000000", reason: "month and day 00" },
  { value: "24061", reason: "five characters" },
  { value: "2406150", reason: "seven characters" },
  { value: "", reason: "empty" },
  { value: "24-06-15", reason: "hyphenated, not 6!n" },
  { value: "2024-06-15", reason: "an ISO date, not 6!n" },
  { value: "20240615", reason: "a DATE4 value, not 6!n" },
  { value: " 240615", reason: "leading space" },
  { value: "240615\n", reason: "trailing newline" },
  { value: "２４０６１５", reason: "full-width digits" },
  { value: "240615EUR1000,", reason: "a field, not the component" },
  { value: ":32A:240615", reason: "a tagged field, not the component" },
];
