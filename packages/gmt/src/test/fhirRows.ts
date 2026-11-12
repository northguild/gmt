/*
 * The inputs of `parseFHIR.test.ts`, written once so `isValidFHIR.test.ts` can assert, for every
 * row, that the validator agrees with the parser. Test-only: the build leaves it out.
 * Every expected value was decided from the spec's Authority table (FHIR R4 Datatypes §2.24.0.1,
 * the R4 regexes, IERS Bulletin C for the leap seconds) before the reader existed.
 */

import type { FhirDateTime, FhirPrecision } from "../types";

/** A string that parses, and what it reads as. */
export interface FhirParseRow {
  input: string;
  expected: FhirDateTime;
}

/** A string that does not parse, and why. */
export interface FhirRejectRow {
  input: string;
  reason: string;
}

const row = (
  input: string,
  precision: FhirPrecision,
  offset: string,
): FhirParseRow => ({ input, expected: { value: input, precision, offset } });

export const FHIR_PARSE_ROWS: FhirParseRow[] = [
  row("2024", "year", ""),
  // the smallest year the R4 pattern allows
  row("0001", "year", ""),
  // nothing is padded
  row("2024-06", "month", ""),
  row("2024-06-15", "day", ""),
  // a leap year
  row("2024-02-29", "day", ""),
  row("2015-02-07T13:28:17-05:00", "second", "-05:00"),
  // `value` keeps `.000Z`
  row("2017-01-01T00:00:00.000Z", "fraction", "+00:00"),
  // the §2.24.0.1 `instant` example
  row("2015-02-07T13:28:17.239+02:00", "fraction", "+02:00"),
  // nine digits
  row("2024-06-15T10:30:00.123456789Z", "fraction", "+00:00"),
  row("2024-06-15T10:30:00+00:00", "second", "+00:00"),
  // one spelling for one fact; `value` keeps `-00:00`
  row("2024-06-15T10:30:00-00:00", "second", "+00:00"),
  // the widest offsets the pattern allows
  row("2024-06-15T10:30:00+14:00", "second", "+14:00"),
  row("2024-06-15T10:30:00-14:00", "second", "-14:00"),
  // an inserted leap second (IERS Bulletin C 52)
  row("2016-12-31T23:59:60Z", "second", "+00:00"),
  // inside the leap second
  row("2016-12-31T23:59:60.5Z", "fraction", "+00:00"),
  // the same second, read at other offsets
  row("2016-12-31T18:59:60-05:00", "second", "-05:00"),
  row("2017-01-01T13:59:60+14:00", "second", "+14:00"),
  row("2016-12-31T09:59:60-14:00", "second", "-14:00"),
  // a June insertion (Bulletin C 49)
  row("2015-06-30T23:59:60Z", "second", "+00:00"),
  // its instant is in year 0000; valid, because only the written year is limited
  row("0001-01-01T00:00:00+14:00", "second", "+14:00"),
  // its instant is in year 10000; still inside Temporal's range
  row("9999-12-31T23:59:59-14:00", "second", "-14:00"),
  // 29 February in a century year that is a leap year (Gregorian: divisible by 400)
  row("2000-02-29", "day", ""),
  // the largest and smallest offsets short of the edge
  row("2024-06-15T10:30:00+13:59", "second", "+13:59"),
  row("2024-06-15T10:30:00.9-14:00", "fraction", "-14:00"),
  // the same inserted leap second, at -00:00, at half-hour offsets and with fractions
  row("2016-12-31T23:59:60-00:00", "second", "+00:00"),
  row("2016-12-31T23:59:60.123-00:00", "fraction", "+00:00"),
  row("2017-01-01T00:59:60+01:00", "second", "+01:00"),
  row("2017-01-01T05:29:60+05:30", "second", "+05:30"),
  row("2017-01-01T13:59:60.999999999+14:00", "fraction", "+14:00"),
  // the first inserted second: Leap_Second.dat steps TAI-UTC from 10 to 11 on 1972-07-01 (MJD 41499), https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat
  row("1972-06-30T23:59:60Z", "second", "+00:00"),
];

const reject = (input: string, reason: string): FhirRejectRow => ({
  input,
  reason,
});

export const FHIR_REJECT_ROWS: FhirRejectRow[] = [
  reject("0000-01-01", "the R4 pattern excludes year 0000"),
  reject("+010000-01-01", "the year is four digits"),
  reject("-000001", "the year is four digits"),
  reject("2024-02-30", "dates SHALL be valid dates"),
  reject("2023-02-29", "not a leap year"),
  reject("2024-04-31", "April has 30 days"),
  reject("2024-13", "no month 13"),
  reject("2024-00", "no month 00"),
  reject("2024-6-15", "the month is padded"),
  reject("2024-06-15T10", "no minutes, seconds or zone"),
  reject("2024-06-15T10:30", "no seconds"),
  reject("2024-06-15T10:30Z", "no seconds"),
  reject("2024-06-15T10:30:00", "a time with no zone"),
  reject("2024-06-15T24:00:00Z", "the time 24:00 is not allowed"),
  reject("2024-06-15T10:30:00+14:30", "offset past 14:00"),
  reject("2024-06-15T10:30:00+15:00", "offset past 14:00"),
  reject("2024-06-15T10:30:00+0200", "offset needs a colon"),
  reject("2024-06-15T10:30:00+02", "offset needs minutes"),
  reject("2024-06-15T10:30:00+02:00:00", "offset has no seconds"),
  reject("2024-06-15T10:30:00.1234567890Z", "ten fraction digits"),
  reject("2024-06-15T10:30:00.Z", "a dot with no digits"),
  reject("2017-12-31T23:59:60Z", "no second was inserted that day"),
  reject("2016-12-31T23:58:60Z", "not the inserted second"),
  reject("2016-12-30T23:59:60Z", "not the inserted second"),
  reject("2016-12-31T23:59:60", "a leap second with no zone"),
  reject("2024-06-15t10:30:00Z", "upper-case T only"),
  reject("2024-06-15T10:30:00z", "upper-case Z only"),
  reject("2024-06-15T10:30:00Z[UTC]", "FHIR has no annotations"),
  reject("2024-06-15[u-ca=iso8601]", "FHIR has no annotations"),
  reject("", "empty"),
  reject(" 2024", "leading space"),
  reject("2024 ", "trailing space"),
  reject("2024-06-15\n", "trailing newline"),
  reject("1900-02-29", "1900 is not a leap year (divisible by 100, not 400)"),
  reject("2100-02-29", "2100 is not a leap year"),
  reject("2024-06-31", "June has 30 days"),
  reject("2024-11-31", "November has 30 days"),
  reject("2024-06-00", "no day 00"),
  reject("2024-06-15Z", "a date takes no zone"),
  reject("2024-06-15T", "a T with no time"),
  reject("2024-06-15T23:60:00Z", "no minute 60"),
  reject("2024-06-15T25:00:00Z", "no hour 25"),
  reject("2024-06-15T10:30:61Z", "no second 61"),
  reject("2024-06-15T10:30:00-14:01", "offset past 14:00 west"),
  reject("2024-06-15T10:30:00+24:00", "offset past 14:00"),
  reject("2024-06-15T10:30:00.0000000000Z", "ten zero fraction digits"),
  reject(
    "2016-12-31T23:59:60.1234567890Z",
    "a leap second with ten fraction digits",
  ),
  reject(
    "2016-12-31T23:59:60+01:00",
    "UTC is 22:59:60, not an inserted second",
  ),
  reject(
    "2016-12-31T23:59:60.5+14:00",
    "UTC is 09:59:60, not an inserted second",
  ),
  reject(
    "2017-12-31T23:59:60.5Z",
    "a fraction does not make a leap second real",
  ),
  reject("2017-01-01T00:59:60-00:00", "UTC is 00:59:60 on 1 January"),
  reject("1971-12-31T23:59:60Z", "before the first inserted second"),
  reject(
    "2016-12-31T23:59:60+00:30",
    "UTC is 23:29:60, not an inserted second",
  ),
];
