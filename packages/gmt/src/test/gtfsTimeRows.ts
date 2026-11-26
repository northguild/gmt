/**
 * The GTFS `Time` rows the parse, validate and format tests share, written by hand from the
 * grammar (GTFS Schedule Reference, revised 27 April 2026, § Field Types, Time: `HH:MM:SS`,
 * `H:MM:SS` also accepted; GMT rule: hours 0-999 in one to three digits, minutes and seconds
 * 00-59) and never read from the code under test. Each expected value is worked from
 * `seconds = (H mod 24) × 3600 + M × 60 + S` and `dayOverflow = ⌊H ÷ 24⌋`.
 */

/** A value that reads as a GTFS time, the two integers it reads as, and the clause behind it. */
export interface GtfsParseRow {
  readonly value: string;
  readonly seconds: number;
  readonly dayOverflow: number;
  readonly reason: string;
}

/** A value that reads as no GTFS time, and why. */
export interface GtfsSentinelRow {
  readonly value: unknown;
  readonly reason: string;
}

export const GTFS_VALID_ROWS: readonly GtfsParseRow[] = [
  {
    value: "25:35:00",
    seconds: 5700,
    dayOverflow: 1,
    reason: "Field Types, Time: 1:35AM on the next day",
  },
  {
    value: "14:30:00",
    seconds: 52_200,
    dayOverflow: 0,
    reason: "Field Types, Time: 2:30PM",
  },
  {
    value: "8:05:00",
    seconds: 29_100,
    dayOverflow: 0,
    reason: "H:MM:SS is accepted",
  },
  {
    value: "08:05:00",
    seconds: 29_100,
    dayOverflow: 0,
    reason: "the HH form of the same value",
  },
  {
    value: "9:00:00",
    seconds: 32_400,
    dayOverflow: 0,
    reason: "one-digit hour",
  },
  {
    value: "9:59:59",
    seconds: 35_999,
    dayOverflow: 0,
    reason: "highest one-digit-hour value",
  },
  {
    value: "0:00:00",
    seconds: 0,
    dayOverflow: 0,
    reason: "one-digit zero hour",
  },
  {
    value: "00:00:00",
    seconds: 0,
    dayOverflow: 0,
    reason: "start of the service day",
  },
  {
    value: "23:59:59",
    seconds: 86_399,
    dayOverflow: 0,
    reason: "last second before the overflow",
  },
  {
    value: "24:00:00",
    seconds: 0,
    dayOverflow: 1,
    reason: "trips.txt blocks example: still the Friday service day",
  },
  {
    value: "24:55:00",
    seconds: 3300,
    dayOverflow: 1,
    reason: "trips.txt blocks example: trip_3 ends",
  },
  {
    value: "26:00:00",
    seconds: 7200,
    dayOverflow: 1,
    reason: "Term Definitions, Service day: 08:00:00 to 26:00:00",
  },
  {
    value: "47:59:59",
    seconds: 86_399,
    dayOverflow: 1,
    reason: "last second of the first overflow day",
  },
  {
    value: "48:00:00",
    seconds: 0,
    dayOverflow: 2,
    reason: "second overflow day",
  },
  {
    value: "72:00:00",
    seconds: 0,
    dayOverflow: 3,
    reason: "third overflow day",
  },
  {
    value: "96:00:00",
    seconds: 0,
    dayOverflow: 4,
    reason: "fourth overflow day",
  },
  {
    value: "99:59:59",
    seconds: 14_399,
    dayOverflow: 4,
    reason: "largest two-digit hour",
  },
  {
    value: "100:00:00",
    seconds: 14_400,
    dayOverflow: 4,
    reason: "first three-digit hour",
  },
  {
    value: "110:29:00",
    seconds: 52_140,
    dayOverflow: 4,
    reason: "VIA Rail Canada feed, trip 112 (Vancouver-Toronto), last stop",
  },
  {
    value: "125:00:00",
    seconds: 18_000,
    dayOverflow: 5,
    reason: "three-digit hour in the fifth overflow day",
  },
  {
    value: "005:00:00",
    seconds: 18_000,
    dayOverflow: 0,
    reason: "three-digit spelling with leading zeros",
  },
  {
    value: "999:59:59",
    seconds: 57_599,
    dayOverflow: 41,
    reason: "largest value three digits write",
  },
];

export const GTFS_SENTINEL_ROWS: readonly GtfsSentinelRow[] = [
  { value: "-01:00:00", reason: "a minus sign" },
  { value: "+01:00:00", reason: "a plus sign" },
  { value: "25:60:00", reason: "minute 60" },
  { value: "25:35:60", reason: "second 60, no leap second" },
  { value: "25:35", reason: "no seconds" },
  { value: "25:35:00.5", reason: "a fraction" },
  { value: "25:35:00,5", reason: "a comma fraction" },
  { value: "1000:00:00", reason: "a four-digit hour" },
  { value: "0005:00:00", reason: "a four-digit hour with a leading zero" },
  { value: "25:35:0", reason: "a one-digit second" },
  { value: "25:5:00", reason: "a one-digit minute" },
  { value: ":35:00", reason: "an empty hour" },
  { value: "25::00", reason: "an empty minute" },
  { value: " 25:35:00", reason: "a leading space, never trimmed" },
  { value: "25:35:00 ", reason: "a trailing space, never trimmed" },
  { value: "25:35:00\n", reason: "a trailing newline" },
  { value: "25:35:00\r\n", reason: "a trailing carriage return and newline" },
  { value: "\t25:35:00", reason: "a leading tab" },
  { value: "﻿25:35:00", reason: "a leading byte order mark, never stripped" },
  { value: "", reason: "an empty field: an interpolated stop gives no time" },
  { value: "25-35-00", reason: "hyphens for colons" },
  { value: "253500", reason: "no separators" },
  { value: "T25:35:00", reason: "an ISO time designator" },
  { value: "25:35:00Z", reason: "a UTC designator" },
  { value: "25:35:00+01:00", reason: "a UTC offset" },
  { value: "PT25H35M", reason: "an ISO duration" },
  { value: "25:35:00[Europe/Oslo]", reason: "a zone annotation" },
  { value: "２５:３５:００", reason: "fullwidth digits" },
  { value: "٢٥:٣٥:٠٠", reason: "Arabic-Indic digits" },
  { value: 5700, reason: "a number" },
  { value: null, reason: "null" },
  { value: undefined, reason: "undefined" },
  { value: new String("25:35:00"), reason: "a String object, not a string" },
  { value: { seconds: 5700, dayOverflow: 1 }, reason: "a parsed record" },
  { value: Symbol("25:35:00"), reason: "a symbol" },
  { value: 25n, reason: "a bigint" },
  { value: ["25:35:00"], reason: "an array holding a string" },
];

/** A record to write, and the GTFS time it writes as. */
export interface GtfsFormatRow {
  readonly seconds: number;
  readonly dayOverflow: number;
  readonly expected: string;
  readonly reason: string;
}

/** A value that writes as no GTFS time, and why. */
export interface GtfsFormatSentinelRow {
  readonly value: unknown;
  readonly reason: string;
}

// Each expected value is worked from H = dayOverflow × 24 + ⌊seconds ÷ 3600⌋,
// M = ⌊seconds ÷ 60⌋ mod 60 and S = seconds mod 60, each padded to at least two digits.
export const GTFS_FORMAT_ROWS: readonly GtfsFormatRow[] = [
  {
    seconds: 5700,
    dayOverflow: 1,
    expected: "25:35:00",
    reason: "Field Types, Time example",
  },
  {
    seconds: 29_100,
    dayOverflow: 0,
    expected: "08:05:00",
    reason: "HH is always written",
  },
  {
    seconds: 52_200,
    dayOverflow: 0,
    expected: "14:30:00",
    reason: "Field Types, Time example",
  },
  {
    seconds: 0,
    dayOverflow: 0,
    expected: "00:00:00",
    reason: "start of the service day",
  },
  {
    seconds: 0,
    dayOverflow: 1,
    expected: "24:00:00",
    reason: "trips.txt blocks example",
  },
  {
    seconds: 3300,
    dayOverflow: 1,
    expected: "24:55:00",
    reason: "trips.txt blocks example",
  },
  {
    seconds: 7200,
    dayOverflow: 1,
    expected: "26:00:00",
    reason: "Term Definitions, Service day",
  },
  {
    seconds: 86_399,
    dayOverflow: 0,
    expected: "23:59:59",
    reason: "last second before the overflow",
  },
  {
    seconds: 86_399,
    dayOverflow: 1,
    expected: "47:59:59",
    reason: "last second of the first overflow day",
  },
  {
    seconds: 0,
    dayOverflow: 4,
    expected: "96:00:00",
    reason: "fourth overflow day",
  },
  {
    seconds: 14_399,
    dayOverflow: 4,
    expected: "99:59:59",
    reason: "largest two-digit hour",
  },
  {
    seconds: 14_400,
    dayOverflow: 4,
    expected: "100:00:00",
    reason: "first three-digit hour",
  },
  {
    seconds: 52_140,
    dayOverflow: 4,
    expected: "110:29:00",
    reason: "VIA Rail Canada feed, trip 112",
  },
  {
    seconds: 0,
    dayOverflow: 5,
    expected: "120:00:00",
    reason: "five whole days",
  },
  {
    seconds: 57_599,
    dayOverflow: 41,
    expected: "999:59:59",
    reason: "largest three-digit value",
  },
  {
    seconds: -0,
    dayOverflow: -0,
    expected: "00:00:00",
    reason: "negative zero is zero",
  },
];

export const GTFS_FORMAT_SENTINEL_ROWS: readonly GtfsFormatSentinelRow[] = [
  {
    value: { seconds: 86_400, dayOverflow: 0 },
    reason: "a whole day in seconds",
  },
  { value: { seconds: -1, dayOverflow: 0 }, reason: "negative seconds" },
  { value: { seconds: 0, dayOverflow: -1 }, reason: "negative overflow days" },
  {
    value: { seconds: 57_600, dayOverflow: 41 },
    reason: "hour 1000 by seconds",
  },
  { value: { seconds: 86_399, dayOverflow: 41 }, reason: "hour 1007" },
  { value: { seconds: 0, dayOverflow: 42 }, reason: "hour 1008" },
  { value: { seconds: 1.5, dayOverflow: 0 }, reason: "fractional seconds" },
  {
    value: { seconds: 0, dayOverflow: 0.5 },
    reason: "fractional overflow days",
  },
  { value: { seconds: NaN, dayOverflow: 0 }, reason: "NaN seconds" },
  { value: { seconds: 0, dayOverflow: NaN }, reason: "NaN overflow days" },
  { value: { seconds: Infinity, dayOverflow: 0 }, reason: "infinite seconds" },
  {
    value: { seconds: 0, dayOverflow: Infinity },
    reason: "infinite overflow days",
  },
  {
    value: { seconds: -Infinity, dayOverflow: 0 },
    reason: "negative infinite seconds",
  },
  { value: { seconds: "5700", dayOverflow: 1 }, reason: "seconds as a string" },
  { value: { seconds: 5700n, dayOverflow: 1n }, reason: "bigint members" },
  {
    value: { seconds: new Number(5700), dayOverflow: 1 },
    reason: "seconds as a Number object",
  },
  { value: { seconds: null, dayOverflow: 0 }, reason: "null seconds" },
  {
    value: {
      seconds: {
        valueOf(): number {
          throw new Error("coerced");
        },
      },
      dayOverflow: 0,
    },
    reason: "seconds as an object whose valueOf throws",
  },
  {
    value: { seconds: 0, dayOverflow: "1" },
    reason: "overflow days as a string",
  },
  {
    value: { seconds: 0, dayOverflow: Number.MAX_SAFE_INTEGER },
    reason: "overflow days far past 999 hours",
  },
  { value: { seconds: 5700 }, reason: "no dayOverflow" },
  { value: { dayOverflow: 1 }, reason: "no seconds" },
  { value: {}, reason: "an empty object" },
  { value: [], reason: "an array has no members" },
  { value: null, reason: "null is not a record" },
  { value: undefined, reason: "undefined is not a record" },
  { value: "25:35:00", reason: "a string is not a record" },
  { value: 5700, reason: "a number is not a record" },
  { value: true, reason: "a boolean is not a record" },
  { value: Symbol("gtfs"), reason: "a symbol is not a record" },
  { value: 5700n, reason: "a bigint is not a record" },
];

/**
 * Every hour 0-999 written in at least two digits, with minutes and seconds each in {0, 1, 30, 59}:
 * 16,000 canonical GTFS time strings, built from the grammar alone.
 */
export function gtfsRoundTripStrings(): string[] {
  const pad2 = (n: number): string => String(n).padStart(2, "0");
  const strings: string[] = [];
  for (let h = 0; h <= 999; h++) {
    for (const m of [0, 1, 30, 59]) {
      for (const s of [0, 1, 30, 59]) {
        strings.push(`${pad2(h)}:${pad2(m)}:${pad2(s)}`);
      }
    }
  }
  return strings;
}
