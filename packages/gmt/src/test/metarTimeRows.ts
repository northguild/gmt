/**
 * The METAR report-time rows the parse and validate tests share, written by hand from the rule
 * (WMO-No. 306 FM 15 reg. 15.3.1: `YYGGggZ`, UTC; GMT rule: the result is the candidate nearest
 * the reference in exact time, a month lacking the day skipped, a tie to the earlier) and never
 * read from the code under test. Each expected instant was also checked against a brute-force
 * search over ±6 months on the polyfill.
 */

/** A group, the reference instant it is read against, the instant it reads as, and why. */
export interface MetarValidRow {
  readonly value: string;
  readonly reference: string;
  readonly expected: string;
  readonly reason: string;
}

/** A group, the reference it is read against, and why it reads as no instant. */
export interface MetarSentinelRow {
  readonly value: string;
  readonly reference: string;
  readonly reason: string;
}

export const METAR_VALID_ROWS: readonly MetarValidRow[] = [
  {
    value: "251200Z",
    reference: "2024-06-25T12:20:00Z",
    expected: "2024-06-25T12:00:00Z",
    reason: "same month, just before",
  },
  {
    value: "302350Z",
    reference: "2024-07-01T00:05:00Z",
    expected: "2024-06-30T23:50:00Z",
    reason: "previous month",
  },
  {
    value: "312350Z",
    reference: "2024-07-01T00:05:00Z",
    expected: "2024-05-31T23:50:00Z",
    reason: "June lacks 31; May nearer than July by 23 h 30 min",
  },
  {
    value: "312350Z",
    reference: "2025-01-01T00:05:00Z",
    expected: "2024-12-31T23:50:00Z",
    reason: "back across a year",
  },
  {
    value: "010010Z",
    reference: "2024-06-30T23:55:00Z",
    expected: "2024-07-01T00:10:00Z",
    reason: "next month",
  },
  {
    value: "010000Z",
    reference: "2024-12-31T23:59:00Z",
    expected: "2025-01-01T00:00:00Z",
    reason: "forward across a year",
  },
  {
    value: "251200Z",
    reference: "2024-06-25T12:00:00Z",
    expected: "2024-06-25T12:00:00Z",
    reason: "candidate equals reference (at or before)",
  },
  {
    value: "151200Z",
    reference: "2024-06-30T12:00:00Z",
    expected: "2024-06-15T12:00:00Z",
    reason: "exact tie, 15 days each way: the earlier",
  },
  {
    value: "151200Z",
    reference: "2024-06-30T12:00:00.000000001Z",
    expected: "2024-07-15T12:00:00Z",
    reason: "1 ns past the tie",
  },
  {
    value: "151200Z",
    reference: "2024-06-30T11:59:59.999999999Z",
    expected: "2024-06-15T12:00:00Z",
    reason: "1 ns before the tie",
  },
  {
    value: "311200Z",
    reference: "2024-05-01T00:00:00Z",
    expected: "2024-03-31T12:00:00Z",
    reason: "April lacks 31; 30 d 12 h each way: the earlier",
  },
  {
    value: "312359Z",
    reference: "2024-03-01T00:00:00Z",
    expected: "2024-01-31T23:59:00Z",
    reason: "February lacks 31: two months back",
  },
  {
    value: "301200Z",
    reference: "2024-03-01T00:00:00Z",
    expected: "2024-03-30T12:00:00Z",
    reason: "February lacks 30; 30 March nearer than 30 January",
  },
  {
    value: "292350Z",
    reference: "2024-03-01T00:05:00Z",
    expected: "2024-02-29T23:50:00Z",
    reason: "leap year has 29 February",
  },
  {
    value: "292350Z",
    reference: "2025-03-01T00:05:00Z",
    expected: "2025-03-29T23:50:00Z",
    reason: "2025 has no 29 February; March is nearer",
  },
  {
    value: "290000Z",
    reference: "2100-03-01T00:00:00Z",
    expected: "2100-03-29T00:00:00Z",
    reason: "2100 is not a leap year",
  },
  {
    value: "302350Z",
    reference: "2024-07-01T00:05:00+02:00",
    expected: "2024-06-30T23:50:00Z",
    reason: "offset reference is 22:05Z on 30 June: months in UTC",
  },
  {
    value: "302350Z",
    reference: "2024-06-30T20:05:00-04:00",
    expected: "2024-06-30T23:50:00Z",
    reason: "negative offset, reference is 00:05Z on 1 July",
  },
  {
    value: "251200Z",
    reference: "2024-06-25T13:20:00+01:00[Europe/London]",
    expected: "2024-06-25T12:00:00Z",
    reason: "annotated reference",
  },
  {
    value: "130000Z",
    reference: "+275760-09-13T00:00:00Z",
    expected: "+275760-09-13T00:00:00Z",
    reason: "last instant, equal",
  },
  {
    value: "140000Z",
    reference: "+275760-09-13T00:00:00Z",
    expected: "+275760-08-14T00:00:00Z",
    reason: "after-candidate out of range, dropped",
  },
  {
    value: "190000Z",
    reference: "-271821-04-20T00:00:00Z",
    expected: "-271821-05-19T00:00:00Z",
    reason: "before-candidate out of range, dropped",
  },
  {
    value: "010000Z",
    reference: "1969-12-31T23:59:00Z",
    expected: "1970-01-01T00:00:00Z",
    reason: "pre-epoch reference floors to its own day",
  },
  {
    value: "310000Z",
    reference: "0000-01-01T00:00:00Z",
    expected: "-000001-12-31T00:00:00Z",
    reason:
      "year 0 reference: the result is written with a signed six-digit year",
  },
  {
    value: "290000Z",
    reference: "2000-03-01T00:00:00Z",
    expected: "2000-02-29T00:00:00Z",
    reason: "2000 is a leap year (divisible by 400)",
  },
  {
    value: "300000Z",
    reference: "2024-02-15T00:00:00Z",
    expected: "2024-01-30T00:00:00Z",
    reason:
      "the reference month lacks the day: 16 d back to 30 January, 44 d on to 30 March",
  },
  {
    value: "300000Z",
    reference: "2023-02-28T23:00:00Z",
    expected: "2023-03-30T00:00:00Z",
    reason:
      "the reference month lacks the day: 29 h 1 min on to 30 March, 29 d 23 h back to 30 January",
  },
  {
    value: "312330Z",
    reference: "1969-12-31T12:00:00Z",
    expected: "1969-12-31T23:30:00Z",
    reason:
      "pre-epoch reference mid-day: its own month, day floored not truncated",
  },
  {
    value: "281200Z",
    reference: "1899-02-28T06:00:00Z",
    expected: "1899-02-28T12:00:00Z",
    reason: "pre-epoch reference in February: same day, 6 h on",
  },
  {
    value: "251200Z",
    reference: "2024-06-15T00:00:00Z[u-ca=hebrew]",
    expected: "2024-06-25T12:00:00Z",
    reason:
      "an elective calendar annotation is ignored and months stay UTC (RFC 9557 3.3): 25 June is 10.5 d on, 25 May 21.5 d back",
  },
  {
    value: "251200Z",
    reference: "2024-06-15T00:00:00Z[!u-ca=hebrew]",
    expected: "2024-06-25T12:00:00Z",
    reason:
      "a critical calendar annotation the engine knows does not change UTC months (RFC 9557 3.3)",
  },
  {
    value: "251200Z",
    reference: "2024-06-15T00:00:00Z[foo=bar]",
    expected: "2024-06-25T12:00:00Z",
    reason: "an elective unknown annotation is ignored (RFC 9557 3.3)",
  },
  {
    value: "251200Z",
    reference: "2024-06-15T02:00:00+02:00[!Europe/Paris]",
    expected: "2024-06-25T12:00:00Z",
    reason:
      "a critical time zone that agrees with the offset is accepted, and months stay UTC: the reference is 00:00Z on 15 June",
  },
];

const REF = "2024-06-25T12:20:00Z";

export const METAR_SENTINEL_ROWS: readonly MetarSentinelRow[] = [
  { value: "251200", reference: REF, reason: "no Z" },
  {
    value: "251200 Z",
    reference: REF,
    reason: "space before Z (reg. 15.3.1 'without a space')",
  },
  { value: "251200z", reference: REF, reason: "lower-case z" },
  { value: " 251200Z", reference: REF, reason: "leading space" },
  { value: "251200Z ", reference: REF, reason: "trailing space" },
  { value: "251200Z\n", reference: REF, reason: "trailing newline" },
  { value: "2512000Z", reference: REF, reason: "seven digits" },
  { value: "25120Z", reference: REF, reason: "five digits" },
  { value: "", reference: REF, reason: "empty" },
  {
    value: "METAR EGLL 251200Z",
    reference: REF,
    reason: "a whole report line",
  },
  { value: "٢٥١٢٠٠Z", reference: REF, reason: "Arabic-Indic digits" },
  { value: "001200Z", reference: REF, reason: "day 00" },
  { value: "321200Z", reference: REF, reason: "day 32" },
  { value: "252400Z", reference: REF, reason: "hour 24" },
  { value: "251260Z", reference: REF, reason: "minute 60" },
  {
    value: "251200Z",
    reference: "2024-06-25T12:20:00",
    reason: "reference without an offset",
  },
  { value: "251200Z", reference: "2024-06-25", reason: "reference is a date" },
  {
    value: "251200Z",
    reference: "2024-06-25T12:20:00z",
    reason: "reference with lower-case z",
  },
  {
    value: "251200Z",
    reference: "2024-06-25 12:20:00Z",
    reason: "reference with a space separator",
  },
  {
    value: "251200Z",
    reference: "2016-12-31T23:59:60Z",
    reason: "reference is a leap second",
  },
  { value: "251200Z", reference: "", reason: "empty reference" },
  {
    value: "251200Z",
    reference: "+275760-09-13T00:00:00.000000001Z",
    reason: "reference 1 ns past the last instant",
  },
  {
    value: "251200Z",
    reference: "-271821-04-19T23:59:59.999999999Z",
    reason: "reference 1 ns before the first instant",
  },
  {
    value: "251200Z",
    reference: "invalid",
    reason: "reference is not an instant",
  },
  {
    value: "251200Z",
    reference: "2024-06-15T00:00:00Z[!foo=bar]",
    reason: "an unknown critical annotation is rejected (RFC 9557 3.3)",
  },
];
