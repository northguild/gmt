/**
 * Shared CCSDS ASCII Time Code A and B rows for `internal/ccsdsAsciiTime.test.ts` and the four
 * `timescale` parse and format tests, so they and the round-trip test read one list. Every value
 * was decided from CCSDS 301.0-B-4 §3.5.1.1-2 and the IERS leap-second table; each `codeB` day is
 * `Temporal.PlainDate.from(date).dayOfYear`, checked with the polyfill. Test-only: shipped code
 * never imports this file.
 */
export interface CcsdsAsciiCase {
  readonly codeA: string;
  readonly codeB: string;
  /** What both parsers return. */
  readonly instant: string;
  /** Fraction length, 0 to 9. */
  readonly digits: number;
  readonly why: string;
}

export const CCSDS_ASCII_CASES: readonly CcsdsAsciiCase[] = [
  {
    codeA: "1988-01-18T17:20:43.123456Z",
    codeB: "1988-018T17:20:43.123456Z",
    instant: "1988-01-18T17:20:43.123456Z",
    digits: 6,
    why: "CCSDS's own examples, §3.5.1.1-2; day 18 of January",
  },
  {
    codeA: "2024-06-15T10:30:00.000000Z",
    codeB: "2024-167T10:30:00.000000Z",
    instant: "2024-06-15T10:30:00.000000Z",
    digits: 6,
    why: "trailing zeros kept; 31+29+31+30+31+15 = day 167 of a leap year",
  },
  {
    codeA: "2024-01-01T00:00:00Z",
    codeB: "2024-001T00:00:00Z",
    instant: "2024-01-01T00:00:00Z",
    digits: 0,
    why: "first day, no fraction; day 1",
  },
  {
    codeA: "2024-02-29T12:00:00Z",
    codeB: "2024-060T12:00:00Z",
    instant: "2024-02-29T12:00:00Z",
    digits: 0,
    why: "leap day; 31 + 29 = day 60",
  },
  {
    codeA: "2024-03-01T00:00:00Z",
    codeB: "2024-061T00:00:00Z",
    instant: "2024-03-01T00:00:00Z",
    digits: 0,
    why: "the day after the leap day; day 61",
  },
  {
    codeA: "2024-12-31T23:59:59.999999999Z",
    codeB: "2024-366T23:59:59.999999999Z",
    instant: "2024-12-31T23:59:59.999999999Z",
    digits: 9,
    why: "day 366 of a leap year, nine digits",
  },
  {
    codeA: "2023-12-31T23:59:59Z",
    codeB: "2023-365T23:59:59Z",
    instant: "2023-12-31T23:59:59Z",
    digits: 0,
    why: "last day of a common year; day 365",
  },
  {
    codeA: "1972-06-30T23:59:60Z",
    codeB: "1972-182T23:59:60Z",
    instant: "1972-06-30T23:59:60Z",
    digits: 0,
    why: "first inserted leap second; 1972 is a leap year, 182 = 31+29+31+30+31+30",
  },
  {
    codeA: "2015-06-30T23:59:60.5Z",
    codeB: "2015-181T23:59:60.5Z",
    instant: "2015-06-30T23:59:60.5Z",
    digits: 1,
    why: "leap second in a common year; 31+28+31+30+31+30 = day 181",
  },
  {
    codeA: "2016-12-31T23:59:60Z",
    codeB: "2016-366T23:59:60Z",
    instant: "2016-12-31T23:59:60Z",
    digits: 0,
    why: "last leap second, in day 366 of a leap year",
  },
  {
    codeA: "0001-01-01T00:00:00Z",
    codeB: "0001-001T00:00:00Z",
    instant: "0001-01-01T00:00:00Z",
    digits: 0,
    why: "lowest year, §3.5.1.1 `YYYY` 0001-9999",
  },
  {
    codeA: "1969-12-31T23:59:59.5Z",
    codeB: "1969-365T23:59:59.5Z",
    instant: "1969-12-31T23:59:59.5Z",
    digits: 1,
    why: "before the Unix epoch: the fraction comes from a negative count; 1969 is common, day 365",
  },
  {
    codeA: "9999-12-31T23:59:59.999999999Z",
    codeB: "9999-365T23:59:59.999999999Z",
    instant: "9999-12-31T23:59:59.999999999Z",
    digits: 9,
    why: "highest year; 9999 is common, day 365",
  },
];
