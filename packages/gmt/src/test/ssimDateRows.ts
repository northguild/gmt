/**
 * The SSIM date rows the parse and validate tests share, written by hand from the grammar
 * (`DDMMMYY`, upper-case English month letters, the caller's hundred-year window) and never read
 * from the code under test.
 */

/** A value that reads as a date, the window it is read in, and the ISO date it reads as. */
export interface SsimValidRow {
  readonly value: string;
  readonly yearWindow: number;
  readonly expected: string;
}

/** A value that reads as no date, the window it is read in, and why. */
export interface SsimSentinelRow {
  readonly value: string;
  readonly yearWindow: number;
  readonly reason: string;
}

export const SSIM_VALID_ROWS: readonly SsimValidRow[] = [
  { value: "01JAN26", yearWindow: 2000, expected: "2026-01-01" },
  { value: "25OCT26", yearWindow: 2000, expected: "2026-10-25" },
  { value: "29FEB24", yearWindow: 2000, expected: "2024-02-29" },
  { value: "29FEB00", yearWindow: 2000, expected: "2000-02-29" },
  { value: "29FEB00", yearWindow: 1901, expected: "2000-02-29" },
  { value: "01JAN00", yearWindow: 2000, expected: "2000-01-01" },
  { value: "31DEC99", yearWindow: 2000, expected: "2099-12-31" },
  { value: "01JAN49", yearWindow: 1950, expected: "2049-01-01" },
  { value: "31DEC49", yearWindow: 1950, expected: "2049-12-31" },
  { value: "01JAN50", yearWindow: 1950, expected: "1950-01-01" },
  { value: "05APR10", yearWindow: 1950, expected: "2010-04-05" },
  { value: "16DEC09", yearWindow: 1950, expected: "2009-12-16" },
  { value: "01JAN00", yearWindow: 0, expected: "0000-01-01" },
  { value: "31DEC99", yearWindow: 0, expected: "0099-12-31" },
  { value: "01JAN05", yearWindow: 9900, expected: "9905-01-01" },
  { value: "31DEC99", yearWindow: 9900, expected: "9999-12-31" },
  { value: "15JAN26", yearWindow: 2000, expected: "2026-01-15" },
  { value: "15FEB26", yearWindow: 2000, expected: "2026-02-15" },
  { value: "15MAR26", yearWindow: 2000, expected: "2026-03-15" },
  { value: "15APR26", yearWindow: 2000, expected: "2026-04-15" },
  { value: "15MAY26", yearWindow: 2000, expected: "2026-05-15" },
  { value: "15JUN26", yearWindow: 2000, expected: "2026-06-15" },
  { value: "15JUL26", yearWindow: 2000, expected: "2026-07-15" },
  { value: "15AUG26", yearWindow: 2000, expected: "2026-08-15" },
  { value: "15SEP26", yearWindow: 2000, expected: "2026-09-15" },
  { value: "15OCT26", yearWindow: 2000, expected: "2026-10-15" },
  { value: "15NOV26", yearWindow: 2000, expected: "2026-11-15" },
  { value: "15DEC26", yearWindow: 2000, expected: "2026-12-15" },
  { value: "31JAN26", yearWindow: 2000, expected: "2026-01-31" },
  { value: "31MAR26", yearWindow: 2000, expected: "2026-03-31" },
  { value: "31MAY26", yearWindow: 2000, expected: "2026-05-31" },
  { value: "31JUL26", yearWindow: 2000, expected: "2026-07-31" },
  { value: "31AUG26", yearWindow: 2000, expected: "2026-08-31" },
  { value: "31OCT26", yearWindow: 2000, expected: "2026-10-31" },
  { value: "31DEC26", yearWindow: 2000, expected: "2026-12-31" },
];

export const SSIM_SENTINEL_ROWS: readonly SsimSentinelRow[] = [
  { value: "29FEB25", yearWindow: 2000, reason: "2025 is not a leap year" },
  { value: "31APR26", yearWindow: 2000, reason: "April has 30 days" },
  { value: "31JUN26", yearWindow: 2000, reason: "June has 30 days" },
  { value: "31SEP26", yearWindow: 2000, reason: "September has 30 days" },
  { value: "31NOV26", yearWindow: 2000, reason: "November has 30 days" },
  { value: "30FEB24", yearWindow: 2000, reason: "February never has 30 days" },
  { value: "00JAN26", yearWindow: 2000, reason: "there is no day 0" },
  { value: "32JAN26", yearWindow: 2000, reason: "January has 31 days" },
  { value: "29FEB00", yearWindow: 1900, reason: "1900 is not a leap year" },
  {
    value: "29FEB00",
    yearWindow: 2001,
    reason: "00 reads as 2100, which is not a leap year",
  },
  { value: "01jan26", yearWindow: 2000, reason: "lower case is not read" },
  { value: "01Jan26", yearWindow: 2000, reason: "mixed case is not read" },
  {
    value: "01jAN26",
    yearWindow: 2000,
    reason: "mixed case is not read (j lower)",
  },
  {
    value: "01JAn26",
    yearWindow: 2000,
    reason:
      "no letter is ever case-converted: folding would turn n into N, and ſ into S",
  },
  { value: "01JANV26", yearWindow: 2000, reason: "French month abbreviation" },
  { value: "01ENE26", yearWindow: 2000, reason: "Spanish month abbreviation" },
  { value: "01MRZ26", yearWindow: 2000, reason: "German month abbreviation" },
  { value: "01OCA26", yearWindow: 2000, reason: "Turkish month abbreviation" },
  {
    value: "01SEPT26",
    yearWindow: 2000,
    reason: "en-GB CLDR short form is four letters",
  },
  { value: "1JAN26", yearWindow: 2000, reason: "one-digit day" },
  { value: "01JAN6", yearWindow: 2000, reason: "one-digit year" },
  { value: "01JAN2026", yearWindow: 2000, reason: "four-digit year" },
  { value: "01JAN", yearWindow: 2000, reason: "no year" },
  { value: "", yearWindow: 2000, reason: "empty" },
  { value: " 01JAN26", yearWindow: 2000, reason: "leading space" },
  { value: "01JAN26 ", yearWindow: 2000, reason: "trailing space" },
  { value: "01JAN26\n", yearWindow: 2000, reason: "trailing newline" },
  { value: "01-JAN-26", yearWindow: 2000, reason: "hyphenated" },
  { value: "2026-01-01", yearWindow: 2000, reason: "an ISO date" },
  { value: "０１JAN26", yearWindow: 2000, reason: "full-width digits" },
  { value: "٠١JAN26", yearWindow: 2000, reason: "Arabic-Indic digits" },
  { value: "00XXX00", yearWindow: 2000, reason: "XXX is not a month" },
  { value: "01JAN٢٦", yearWindow: 2000, reason: "Arabic-Indic year digits" },
  { value: "01JAN26X", yearWindow: 2000, reason: "a trailing letter" },
  { value: "X01JAN26", yearWindow: 2000, reason: "a leading letter" },
];
