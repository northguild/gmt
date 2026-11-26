/**
 * The SWIFT value-date rows the parse and validate tests share, written by hand from SWIFT
 * _Standards MT General Information_ (Standards MT November 2025) §6.3.1 (the six-digit date
 * runs from 2001 to 2060) and §6.3.6 (`YY` 01 through 60, anything else T50), and the MT 103
 * field 32A rule that the date must be a valid `YYMMDD`. Never read from the code under test.
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
  { value: "350615", expected: "2035-06-15" },
  { value: "010101", expected: "2001-01-01" },
  { value: "601231", expected: "2060-12-31" },
  { value: "040229", expected: "2004-02-29" },
  { value: "240229", expected: "2024-02-29" },
  { value: "600229", expected: "2060-02-29" },
  { value: "020103", expected: "2002-01-03" },
  { value: "240131", expected: "2024-01-31" },
  { value: "240430", expected: "2024-04-30" },
  { value: "241231", expected: "2024-12-31" },
];

export const SWIFT_SENTINEL_ROWS: readonly SwiftSentinelRow[] = [
  { value: "000101", reason: "YY 00 is outside 01 to 60 (T50)" },
  { value: "001231", reason: "YY 00 at year end" },
  { value: "000229", reason: "YY 00, though 2000 had a 29 February" },
  { value: "610101", reason: "YY 61 is outside 01 to 60 (T50)" },
  { value: "611231", reason: "YY 61 at year end" },
  { value: "750101", reason: "YY 75 is outside 01 to 60 (T50)" },
  { value: "800101", reason: "YY 80: the 2006 rule read it as 1980 (T50)" },
  { value: "990615", reason: "YY 99: the 2006 rule read it as 1999 (T50)" },
  { value: "991231", reason: "the last YY at year end (T50)" },
  { value: "850229", reason: "YY 85 is outside 01 to 60 (T50)" },
  { value: "050229", reason: "2005 is not a leap year" },
  { value: "010229", reason: "2001 is not a leap year" },
  { value: "240230", reason: "no 30 February in 2024" },
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
