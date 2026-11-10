/**
 * The FIX `UTCTimestamp` inputs the parser accepts and refuses, shared by
 * `finance/parse/parseFixUtcTimestamp.test.ts` and `finance/validate/isValidFixUtcTimestamp.test.ts`
 * so the validator is held to the parser on one list. Every value was decided from the FIX Latest
 * `UTCTimestamp` rules and the IERS leap-second table, not from the code. Test-only: shipped code
 * never imports this file.
 */

/** Values the parser reads: one per width, the edges of the range, and the inserted leap seconds. */
export const ACCEPTED_FIX_UTC_TIMESTAMPS: readonly string[] = [
  "20240615-14:30:00",
  "20240615-14:30:00.123",
  "20240615-14:30:00.123456",
  "20240615-14:30:00.123456789",
  "20240615-14:30:00.123456789012",
  "20240615-14:30:00.100",
  "20240615-14:30:00.000",
  "20240615-14:30:00.000000000000",
  "20240615-14:30:00.000000000999",
  "19981231-23:59:59",
  "19990101-00:00:00",
  "20240229-00:00:00",
  "19600101-12:00:00",
  "00000101-00:00:00",
  "99991231-23:59:59.999999999999",
  "20240615-14:30:00.120000",
  "20240615-14:30:00.123000000",
  "20240615-14:30:00.123456789000",
  "20240615-14:30:00.123456789120",
  "20161231-23:59:60",
  "20161231-23:59:60.500",
  "20161231-23:59:60.999999999999",
  "19981231-23:59:60",
  "19720630-23:59:60",
];

export interface RefusedFixUtcTimestamp {
  readonly value: string;
  readonly why: string;
}

/** Values the parser refuses for their shape, a field out of range, or characters FIX does not allow. */
export const REFUSED_FIX_UTC_TIMESTAMPS: readonly RefusedFixUtcTimestamp[] = [
  { value: "20240615-14:30:61", why: "seconds above 60 (FIX: SS = 00-60)" },
  { value: "20240615-14:30:00.12", why: "2 digits: FIX names no precision" },
  { value: "20240615-14:30:00.1", why: "1 digit" },
  { value: "20240615-14:30:00.1234", why: "4 digits" },
  { value: "20240615-14:30:00.1234567890", why: "10 digits" },
  { value: "20240615-14:30:00.12345678901", why: "11 digits" },
  { value: "20240615-14:30:00.1234567890123", why: "13 digits" },
  {
    value: "20240615-14:30:00.",
    why: "a period needs digits (FIX: no fraction, no period)",
  },
  { value: "20240615 14:30:00", why: "a space for the dash" },
  { value: "20240615T14:30:00", why: "ISO T for the dash" },
  { value: "20240615-143000", why: "no colons" },
  { value: "2024061514:30:00", why: "no dash" },
  { value: "2024-06-15T14:30:00Z", why: "ISO 8601, not the FIX form" },
  { value: "20240615-14:30:00Z", why: "a zone designator" },
  { value: "20240615-14:30:00+00:00", why: "an offset" },
  { value: "20240230-00:00:00", why: "30 February" },
  { value: "20230229-00:00:00", why: "29 February in a common year" },
  { value: "20240631-00:00:00", why: "31 June" },
  { value: "20241301-00:00:00", why: "month 13" },
  { value: "20240001-00:00:00", why: "month 00" },
  { value: "20240600-00:00:00", why: "day 00" },
  { value: "20240615-24:00:00", why: "hour 24 (FIX: HH = 00-23)" },
  { value: "20240615-14:60:00", why: "minute 60 (FIX: MM = 00-59)" },
  { value: "", why: "empty" },
  { value: " 20240615-14:30:00", why: "leading space" },
  { value: "20240615-14:30:00 ", why: "trailing space" },
  { value: "20240615-14:30:00\n", why: "trailing newline" },
  { value: "٢٠٢٤٠٦١٥-١٤:٣٠:٠٠", why: "Arabic-Indic digits" },
  { value: "20240615", why: "a date only" },
  { value: "14:30:00", why: "a time only" },
  { value: "20240615-14:30", why: "no seconds" },
];

/** A second of 60 that is not one of the 27 inserted leap seconds. */
export const REFUSED_FIX_LEAP_SECONDS: readonly RefusedFixUtcTimestamp[] = [
  {
    value: "20171231-23:59:60",
    why: "no insertion on 2017-12-31 (the 2017 step was on 1 January, inserted on 2016-12-31)",
  },
  { value: "20240615-14:30:60", why: "60 on an ordinary day and minute" },
  {
    value: "20161231-23:58:60",
    why: "60 in the wrong minute of an insertion day",
  },
  {
    value: "20161231-22:59:60",
    why: "60 in the wrong hour of an insertion day",
  },
  {
    value: "19711231-23:59:60",
    why: "before the table: no leap seconds before 1972",
  },
  {
    value: "20160630-23:59:60",
    why: "30 June 2016: only 31 December had an insertion that year",
  },
  {
    value: "20151231-23:59:60",
    why: "31 December 2015: only 30 June had an insertion that year",
  },
  {
    value: "20121231-23:59:60",
    why: "31 December 2012: only 30 June had an insertion that year",
  },
  {
    value: "20170101-23:59:60",
    why: "the day after an insertion, not the insertion day",
  },
  {
    value: "20171231-23:59:60.500",
    why: "a fraction does not make a non-insertion day valid",
  },
  {
    value: "19700630-23:59:60",
    why: "30 June 1970: before the table, on a June 30",
  },
  { value: "00001231-23:59:60", why: "year 0000 is before the table" },
  { value: "99991231-23:59:60", why: "after the closed table (Bulletin C 72)" },
];
