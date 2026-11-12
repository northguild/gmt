/**
 * The NOTAM validity rows the parse and validate tests share, written by hand from OPADD 4.1
 * §2.3.16 and §2.3.17 (`YYMMDDHHMM`, `EST`, `PERM`, the caller's hundred-year window) and never
 * read from the code under test.
 */
import type { NotamValidity } from "../types/notam";

/** A value that reads as a validity, the window it is read in, and what it reads as. */
export interface NotamValidRow {
  readonly value: string;
  readonly yearWindow: number;
  readonly expected: NotamValidity;
  readonly reason: string;
}

/** A value that reads as no validity, the window it is read in, and why. */
export interface NotamSentinelRow {
  readonly value: string;
  readonly yearWindow: number;
  readonly reason: string;
}

const at = (instant: string, estimated = false): NotamValidity => ({
  kind: "instant",
  instant,
  estimated,
});

export const NOTAM_VALID_ROWS: readonly NotamValidRow[] = [
  {
    value: "2506151200",
    yearWindow: 2000,
    expected: at("2025-06-15T12:00:00Z"),
    reason: "a plain date-time",
  },
  {
    value: "1407011200",
    yearWindow: 2000,
    expected: at("2014-07-01T12:00:00Z"),
    reason: "the OPADD example date",
  },
  {
    value: "1407022030",
    yearWindow: 2000,
    expected: at("2014-07-02T20:30:00Z"),
    reason: "an evening time",
  },
  {
    value: "1407031230EST",
    yearWindow: 2000,
    expected: at("2014-07-03T12:30:00Z", true),
    reason: "an estimated end",
  },
  {
    value: "PERM",
    yearWindow: 2000,
    expected: { kind: "permanent" },
    reason: "permanent",
  },
  {
    value: "2501010000",
    yearWindow: 2000,
    expected: at("2025-01-01T00:00:00Z"),
    reason: "midnight, 0000",
  },
  {
    value: "2512312359",
    yearWindow: 2000,
    expected: at("2025-12-31T23:59:00Z"),
    reason: "last minute of a year",
  },
  {
    value: "2402291200",
    yearWindow: 2000,
    expected: at("2024-02-29T12:00:00Z"),
    reason: "leap day 2024",
  },
  {
    value: "0002290000",
    yearWindow: 2000,
    expected: at("2000-02-29T00:00:00Z"),
    reason: "2000 is a leap year",
  },
  {
    value: "9912312359EST",
    yearWindow: 1950,
    expected: at("1999-12-31T23:59:00Z", true),
    reason: "window 1950 puts 99 in 1999",
  },
  {
    value: "4901010000",
    yearWindow: 1950,
    expected: at("2049-01-01T00:00:00Z"),
    reason: "window 1950 puts 49 in 2049",
  },
  {
    value: "5001010000",
    yearWindow: 1950,
    expected: at("1950-01-01T00:00:00Z"),
    reason: "window 1950 puts 50 at its start, 1950",
  },
  {
    value: "2506151200",
    yearWindow: 0,
    expected: at("0025-06-15T12:00:00Z"),
    reason: "window 0 puts 25 in year 25",
  },
  {
    value: "9912312359",
    yearWindow: 9900,
    expected: at("9999-12-31T23:59:00Z"),
    reason: "window 9900 puts 99 at 9999",
  },
  {
    value: "0001010000",
    yearWindow: 9900,
    expected: at("9900-01-01T00:00:00Z"),
    reason: "window 9900 puts 00 at 9900",
  },
];

export const NOTAM_SENTINEL_ROWS: readonly NotamSentinelRow[] = [
  { value: "2506152400", yearWindow: 2000, reason: "OPADD: do not use '2400'" },
  { value: "2506151260", yearWindow: 2000, reason: "minute 60" },
  { value: "2513151200", yearWindow: 2000, reason: "month 13" },
  { value: "2500151200", yearWindow: 2000, reason: "month 00" },
  { value: "2506001200", yearWindow: 2000, reason: "day 00" },
  {
    value: "2502301200",
    yearWindow: 2000,
    reason: "February never has 30 days",
  },
  { value: "2502291200", yearWindow: 2000, reason: "2025 is not a leap year" },
  { value: "0002290000", yearWindow: 1900, reason: "1900 is not a leap year" },
  { value: "2504311200", yearWindow: 2000, reason: "April has 30 days" },
  { value: "0002290000", yearWindow: 2100, reason: "2100 is not a leap year" },
  {
    value: "2506152400EST",
    yearWindow: 2000,
    reason: "EST keeps the 2400 rule",
  },
  {
    value: "2513151200EST",
    yearWindow: 2000,
    reason: "EST keeps the month rule",
  },
  {
    value: "1407031230 EST",
    yearWindow: 2000,
    reason: "OPADD: no space before EST",
  },
  { value: "1407031230est", yearWindow: 2000, reason: "lower-case EST" },
  { value: "1407031230Est", yearWindow: 2000, reason: "mixed-case EST" },
  { value: "perm", yearWindow: 2000, reason: "lower-case PERM" },
  { value: "Perm", yearWindow: 2000, reason: "mixed-case PERM" },
  { value: "PERM ", yearWindow: 2000, reason: "trailing space" },
  { value: " PERM", yearWindow: 2000, reason: "leading space" },
  { value: "PERM\n", yearWindow: 2000, reason: "trailing newline" },
  { value: "PERMEST", yearWindow: 2000, reason: "PERM takes no EST" },
  { value: "1407031230ESTX", yearWindow: 2000, reason: "trailing letter" },
  { value: "140703123", yearWindow: 2000, reason: "nine digits" },
  { value: "14070312300", yearWindow: 2000, reason: "eleven digits" },
  { value: "202506151200", yearWindow: 2000, reason: "four-digit year" },
  {
    value: "C) 1407022030",
    yearWindow: 2000,
    reason: "item label is not part of the value",
  },
  {
    value: "B) 1407011200",
    yearWindow: 2000,
    reason: "item label is not part of the value",
  },
  { value: "WIE", yearWindow: 2000, reason: "OPADD: 'WIE' is not permitted" },
  { value: "UFN", yearWindow: 2000, reason: "OPADD: 'UFN' is not permitted" },
  {
    value: "1407031230APRX DUR",
    yearWindow: 2000,
    reason: "OPADD: 'APRX DUR' is not permitted",
  },
  { value: "2506151200Z", yearWindow: 2000, reason: "no Z suffix" },
  { value: "2506151200\n", yearWindow: 2000, reason: "trailing newline" },
  { value: "", yearWindow: 2000, reason: "empty" },
  { value: "٢٥٠٦١٥١٢٠٠", yearWindow: 2000, reason: "Arabic-Indic digits" },
];

/** Options that carry no usable window: every value, including `PERM`, reads as no validity. */
export const NOTAM_BAD_OPTIONS: readonly {
  readonly options: unknown;
  readonly reason: string;
}[] = [
  { options: {}, reason: "no yearWindow" },
  { options: undefined, reason: "omitted options" },
  { options: { yearWindow: undefined }, reason: "yearWindow undefined" },
  { options: { yearWindow: 2000.5 }, reason: "not an integer" },
  { options: { yearWindow: 9901 }, reason: "above 9900" },
  { options: { yearWindow: -1 }, reason: "below 0" },
  { options: { yearWindow: "2000" }, reason: "a numeric string" },
  {
    options: { yearWindow: "Rolling" },
    reason: "a capitalised string is not 'rolling'",
  },
  { options: { yearWindow: Number.NaN }, reason: "NaN" },
  { options: null, reason: "null options" },
  { options: "2000", reason: "a string for options" },
  { options: 2000, reason: "a number for options" },
];
