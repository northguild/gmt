import { Temporal } from "@js-temporal/polyfill";
import {
  classifyEdifactDtmFormat,
  classifyX12DateTimePeriodFormat,
  classifyX12TimeCode,
  formatEdifactDate,
  formatEdifactDatePeriod,
  formatEdifactDateTime,
  formatEdifactDateTimePeriod,
  formatEdifactOffsetDateTime,
  formatEdifactTime,
  formatX12Date,
  formatX12DateRange,
  formatX12DateTime,
  formatX12DateTimeRange,
  formatX12Time,
  isValidEdifactDate,
  isValidEdifactDatePeriod,
  isValidEdifactDateTime,
  isValidEdifactDateTimePeriod,
  isValidEdifactDtmFormat,
  isValidEdifactOffsetDateTime,
  isValidEdifactTime,
  isValidX12Date,
  isValidX12DateAndTime,
  isValidX12DateRange,
  isValidX12DateTime,
  isValidX12DateTimePeriodFormat,
  isValidX12DateTimeRange,
  isValidX12Time,
  isValidX12TimeCode,
  parseEdifactDate,
  parseEdifactDatePeriod,
  parseEdifactDateTime,
  parseEdifactDateTimePeriod,
  parseEdifactOffsetDateTime,
  parseEdifactTime,
  parseX12Date,
  parseX12DateAndTime,
  parseX12DateRange,
  parseX12DateTime,
  parseX12DateTimeRange,
  parseX12Time,
  x12TimeCodeOffset,
  x12TimeCodeZone,
} from "../intermodal";
import type { EdiDatePeriod, EdiDateTimePeriod } from "../types/edi";
import {
  CUT_EDIFACT_FORMATS,
  CUT_X12_FORMATS,
  EDIFACT_FORMAT_KINDS,
  X12_FORMAT_KINDS,
  edifactFormatsOf,
  x12FormatsOf,
} from "./ediCodes";
import { X12_TIME_CODES } from "../internal";
import { X12_TIME_CODE_EXPECTATIONS } from "./x12TimeCodeMatrix";

/** The two ends a period or range parser returns: two dates, or two local date-times. */
type EdiPeriod = EdiDatePeriod | EdiDateTimePeriod;

/**
 * The proof of the rule the EDI functions are built to: **a call the types accept returns a
 * value.** For every parser and formatter pair, and every code in its union:
 *
 * (a) every valid house value of its kind formats to a value, and that value parses back to the
 *     input cut to the mask's precision; the only exceptions are the two value-level facts no
 *     signature can state, asserted here as sentinels: an offset that is not whole hours under
 *     `303` and `304`, and a period or range whose end precedes its start;
 * (b) every house value of another kind returns the sentinel;
 * (c) every cut code returns the sentinel from every function, and `""` from both classifiers;
 * (d) both classifiers agree with the per-kind format unions for every code.
 *
 * Expected values never come from the functions under test. The kind of each code is the table
 * in `ediCodes.ts`, written from the standards' masks. The precision of each mask is the table
 * below, written from the same masks. A value cut to that precision is plain Temporal:
 * `round({ smallestUnit, roundingMode: "trunc" })`.
 *
 * The digits each valid pair writes are asserted too, so a round trip that is wrong the same way
 * in both directions (a zero offset written `UTC`, or with a minus sign) cannot pass. They are
 * plain Temporal strings with their punctuation removed, laid out by the three tables below.
 */

type Precision = "minute" | "second";
type Sentinel = "" | null;

/** Whether each mask with a time ends at `MM` (the minute) or `SS` (the second), read off the mask. */
const PRECISION: Record<string, Precision> = {
  // UNTDID 2379: 401 HHMM, 402 HHMMSS, 203 CCYYMMDDHHMM, 204 CCYYMMDDHHMMSS, 205 …HHMMZHHMM,
  // 208 …HHMMSSZHHMM, 303 …HHMMZZZ, 304 …HHMMSSZZZ, 719 CCYYMMDDHHMM-CCYYMMDDHHMM.
  "401": "minute",
  "402": "second",
  "203": "minute",
  "204": "second",
  "205": "minute",
  "208": "second",
  "303": "minute",
  "304": "second",
  "719": "minute",
  // X12 1250: TM HHMM, TS HHMMSS, DT CCYYMMDDHHMM, RTS CCYYMMDDHHMMSS, RDT …HHMM-…HHMM,
  // DTS …HHMMSS-…HHMMSS.
  TM: "minute",
  TS: "second",
  DT: "minute",
  RTS: "second",
  RDT: "minute",
  DTS: "second",
};

/** The 2379 codes whose offset field is `ZZZ`: a signed hour, so whole hours only. */
const WHOLE_HOUR_OFFSET_FORMATS: readonly string[] = ["303", "304"];

/** The 1250 codes whose date is `MMDDCCYY`. Every other mask with a date is `CCYYMMDD`. */
const MONTH_FIRST_FORMATS: readonly string[] = ["DB", "RD"];

/**
 * The digits of a date under a code's mask: Temporal's `YYYY-MM-DD` without its hyphens, or with
 * the year moved last for `MMDDCCYY`.
 */
function dateDigits(value: string, code: string): string {
  const [year, month, day] = Temporal.PlainDate.from(value)
    .toString()
    .split("-");
  return MONTH_FIRST_FORMATS.includes(code)
    ? `${month}${day}${year}`
    : `${year}${month}${day}`;
}

/**
 * The digits of a time under a code's mask: Temporal's `HH:MM` or `HH:MM:SS`, truncated, without
 * its colons.
 */
function timeDigits(value: string, code: string): string {
  return Temporal.PlainTime.from(value)
    .toString({ smallestUnit: PRECISION[code], roundingMode: "trunc" })
    .replaceAll(":", "");
}

/**
 * The characters of an offset `±HH:MM` under a code's mask: `ZHHMM` is the offset without its
 * colon (205, 208), and `ZZZ` is its sign and hour (303, 304; UN/ECE Recommendation 7 ¶12).
 */
function offsetCharacters(offset: string, code: string): string {
  return WHOLE_HOUR_OFFSET_FORMATS.includes(code)
    ? offset.slice(0, 3)
    : offset.replace(":", "");
}

/** What one house value is written as under a code, from the code's mask and plain Temporal. */
function wireOf(
  valueKind: "date" | "time" | "dateTime",
  code: string,
  value: string,
): string {
  if (valueKind === "date") {
    return dateDigits(value, code);
  }
  if (valueKind === "time") {
    return timeDigits(value, code);
  }
  return `${dateDigits(value, code)}${timeDigits(value, code)}`;
}

// ---------------------------------------------------------------------------------------------
// House values, in ascending order within each kind: a value with seconds, one with a fraction,
// 29 February 2024, and years 0000 and 9999.
// ---------------------------------------------------------------------------------------------

const DATES = ["0000-01-01", "2024-02-29", "2024-06-15", "9999-12-31"];

const TIMES = [
  "00:00:00",
  "14:30",
  "14:30:45",
  "14:30:45.123",
  "23:59:59.999999999",
];

const DATE_TIMES = [
  "0000-01-01T00:00:00",
  "2024-02-29T23:59:59",
  "2024-06-15T14:30",
  "2024-06-15T14:30:45",
  "2024-06-15T14:30:45.9",
  "9999-12-31T23:59:59.999999999",
];

/** Every whole-hour offset in use, from −12:00 to +14:00: 27 offsets. */
const WHOLE_HOUR_OFFSETS = Array.from({ length: 27 }, (_, index) => {
  const hours = index - 12;
  const sign = hours < 0 ? "-" : "+";
  return `${sign}${String(Math.abs(hours)).padStart(2, "0")}:00`;
});

/** Offsets in use that are not whole hours: half and three-quarter hours, east and west. */
const PART_HOUR_OFFSETS = ["-09:30", "-03:30", "+05:30", "+05:45", "+12:45"];

interface OffsetValue {
  /** The house value: the wall clock, then its offset or `Z`. */
  value: string;
  wall: string;
  /** The offset as the parser writes it: `Z` is `+00:00`. */
  offset: string;
  wholeHour: boolean;
}

const OFFSET_DATE_TIMES: OffsetValue[] = DATE_TIMES.flatMap((wall) => [
  ...WHOLE_HOUR_OFFSETS.map((offset) => ({
    value: `${wall}${offset}`,
    wall,
    offset,
    wholeHour: true,
  })),
  ...PART_HOUR_OFFSETS.map((offset) => ({
    value: `${wall}${offset}`,
    wall,
    offset,
    wholeHour: false,
  })),
  { value: `${wall}Z`, wall, offset: "+00:00", wholeHour: true },
]);

/** A value cut to the mask's precision, by plain Temporal. */
function cutTime(value: string, precision: Precision): string {
  return Temporal.PlainTime.from(value)
    .round({ smallestUnit: precision, roundingMode: "trunc" })
    .toString();
}

function cutDateTime(value: string, precision: Precision): string {
  return Temporal.PlainDateTime.from(value)
    .round({ smallestUnit: precision, roundingMode: "trunc" })
    .toString();
}

/** Every ordered pair of a list: `forward` has start ≤ end, `reversed` has start > end. */
function pairsOf(values: readonly string[]): {
  forward: [string, string][];
  reversed: [string, string][];
} {
  const forward: [string, string][] = [];
  const reversed: [string, string][] = [];
  values.forEach((start, i) => {
    values.forEach((end, j) => {
      (i <= j ? forward : reversed).push([start, end]);
    });
  });
  return { forward, reversed };
}

// ---------------------------------------------------------------------------------------------
// The function pairs. Each wrapper takes the code as a plain string, so a code outside the
// function's union can be passed as data.
// ---------------------------------------------------------------------------------------------

type ValueKind = "date" | "time" | "dateTime" | "offsetDateTime";

interface SingleKind {
  standard: "UN/EDIFACT" | "X12";
  /** The function names' prefix, and the kind they end in: `parse` + family + kindName. */
  family: "Edifact" | "X12";
  kindName: string;
  valueKind: ValueKind;
  codes: readonly string[];
  format: (value: string, code: string, extra?: unknown) => string;
  parse: (wire: string, code: string, extra?: unknown) => string;
  isValid: (wire: string, code: string, extra?: unknown) => boolean;
}

interface RangeKind {
  standard: "UN/EDIFACT" | "X12";
  family: "Edifact" | "X12";
  kindName: string;
  valueKind: "date" | "dateTime";
  codes: readonly string[];
  format: (start: string, end: string, code: string, extra?: unknown) => string;
  parse: (wire: string, code: string, extra?: unknown) => EdiPeriod | null;
  isValid: (wire: string, code: string, extra?: unknown) => boolean;
}

/** A public function called with whatever arguments the row gives it. */
function loose<Result>(fn: unknown): (...args: unknown[]) => Result {
  return fn as (...args: unknown[]) => Result;
}

const SINGLE_KINDS: SingleKind[] = [
  {
    standard: "UN/EDIFACT",
    family: "Edifact",
    kindName: "Date",
    valueKind: "date",
    codes: edifactFormatsOf("date"),
    format: loose<string>(formatEdifactDate),
    parse: loose<string>(parseEdifactDate),
    isValid: loose<boolean>(isValidEdifactDate),
  },
  {
    standard: "UN/EDIFACT",
    family: "Edifact",
    kindName: "Time",
    valueKind: "time",
    codes: edifactFormatsOf("time"),
    format: loose<string>(formatEdifactTime),
    parse: loose<string>(parseEdifactTime),
    isValid: loose<boolean>(isValidEdifactTime),
  },
  {
    standard: "UN/EDIFACT",
    family: "Edifact",
    kindName: "DateTime",
    valueKind: "dateTime",
    codes: edifactFormatsOf("dateTime"),
    format: loose<string>(formatEdifactDateTime),
    parse: loose<string>(parseEdifactDateTime),
    isValid: loose<boolean>(isValidEdifactDateTime),
  },
  {
    standard: "UN/EDIFACT",
    family: "Edifact",
    kindName: "OffsetDateTime",
    valueKind: "offsetDateTime",
    codes: edifactFormatsOf("offsetDateTime"),
    format: loose<string>(formatEdifactOffsetDateTime),
    parse: loose<string>(parseEdifactOffsetDateTime),
    isValid: loose<boolean>(isValidEdifactOffsetDateTime),
  },
  {
    standard: "X12",
    family: "X12",
    kindName: "Date",
    valueKind: "date",
    codes: x12FormatsOf("date"),
    format: loose<string>(formatX12Date),
    parse: loose<string>(parseX12Date),
    isValid: loose<boolean>(isValidX12Date),
  },
  {
    standard: "X12",
    family: "X12",
    kindName: "Time",
    valueKind: "time",
    codes: x12FormatsOf("time"),
    format: loose<string>(formatX12Time),
    // A time written under a 1250 qualifier is read against that qualifier.
    parse: loose<string>(parseX12Time),
    isValid: loose<boolean>(isValidX12Time),
  },
  {
    standard: "X12",
    family: "X12",
    kindName: "DateTime",
    valueKind: "dateTime",
    codes: x12FormatsOf("dateTime"),
    format: loose<string>(formatX12DateTime),
    parse: loose<string>(parseX12DateTime),
    isValid: loose<boolean>(isValidX12DateTime),
  },
];

const RANGE_KINDS: RangeKind[] = [
  {
    standard: "UN/EDIFACT",
    family: "Edifact",
    kindName: "DatePeriod",
    valueKind: "date",
    codes: edifactFormatsOf("datePeriod"),
    format: loose<string>(formatEdifactDatePeriod),
    parse: loose<EdiPeriod | null>(parseEdifactDatePeriod),
    isValid: loose<boolean>(isValidEdifactDatePeriod),
  },
  {
    standard: "UN/EDIFACT",
    family: "Edifact",
    kindName: "DateTimePeriod",
    valueKind: "dateTime",
    codes: edifactFormatsOf("dateTimePeriod"),
    format: loose<string>(formatEdifactDateTimePeriod),
    parse: loose<EdiPeriod | null>(parseEdifactDateTimePeriod),
    isValid: loose<boolean>(isValidEdifactDateTimePeriod),
  },
  {
    standard: "X12",
    family: "X12",
    kindName: "DateRange",
    valueKind: "date",
    codes: x12FormatsOf("dateRange"),
    format: loose<string>(formatX12DateRange),
    parse: loose<EdiPeriod | null>(parseX12DateRange),
    isValid: loose<boolean>(isValidX12DateRange),
  },
  {
    standard: "X12",
    family: "X12",
    kindName: "DateTimeRange",
    valueKind: "dateTime",
    codes: x12FormatsOf("dateTimeRange"),
    format: loose<string>(formatX12DateTimeRange),
    parse: loose<EdiPeriod | null>(parseX12DateTimeRange),
    isValid: loose<boolean>(isValidX12DateTimeRange),
  },
];

// ---------------------------------------------------------------------------------------------
// (a) Valid pairs, and the two listed exceptions.
// ---------------------------------------------------------------------------------------------

interface SingleRow {
  standard: string;
  family: string;
  kindName: string;
  /** The suffix the three function names share, for a test's title. */
  label: string;
  code: string;
  value: string;
  /** The element value the mask gives for `value`. */
  wire: string;
  /** What the written value parses back to: the input cut to the mask's precision. */
  expected: string;
  kind: SingleKind;
}

interface RangeRow {
  standard: string;
  family: string;
  kindName: string;
  label: string;
  code: string;
  start: string;
  end: string;
  /** The element value the mask gives: the two halves, joined by one hyphen in X12 only. */
  wire: string;
  expected: EdiPeriod;
  kind: RangeKind;
}

/** The valid house values of a kind under a code, each with what it reads back as. */
function expectedSingles(
  valueKind: ValueKind,
  code: string,
): { value: string; wire: string; expected: string }[] {
  if (valueKind === "date") {
    return DATES.map((value) => ({
      value,
      wire: wireOf("date", code, value),
      expected: Temporal.PlainDate.from(value).toString(),
    }));
  }
  if (valueKind === "time") {
    return TIMES.map((value) => ({
      value,
      wire: wireOf("time", code, value),
      expected: cutTime(value, PRECISION[code]),
    }));
  }
  if (valueKind === "dateTime") {
    return DATE_TIMES.map((value) => ({
      value,
      wire: wireOf("dateTime", code, value),
      expected: cutDateTime(value, PRECISION[code]),
    }));
  }
  // The wall clock as written, then its offset: never the UTC clock.
  return OFFSET_DATE_TIMES.filter(
    ({ wholeHour }) => wholeHour || !WHOLE_HOUR_OFFSET_FORMATS.includes(code),
  ).map(({ value, wall, offset }) => ({
    value,
    wire: `${wireOf("dateTime", code, wall)}${offsetCharacters(offset, code)}`,
    expected: `${cutDateTime(wall, PRECISION[code])}${offset}`,
  }));
}

const VALID_SINGLES: SingleRow[] = SINGLE_KINDS.flatMap((kind) =>
  kind.codes.flatMap((code) =>
    expectedSingles(kind.valueKind, code).map(({ value, wire, expected }) => ({
      standard: kind.standard,
      family: kind.family,
      kindName: kind.kindName,
      label: `${kind.family}${kind.kindName}`,
      code,
      value,
      wire,
      expected,
      kind,
    })),
  ),
);

function rangeRows(direction: "forward" | "reversed"): RangeRow[] {
  return RANGE_KINDS.flatMap((kind) =>
    kind.codes.flatMap((code) =>
      pairsOf(kind.valueKind === "date" ? DATES : DATE_TIMES)[direction].map(
        ([start, end]) => ({
          standard: kind.standard,
          family: kind.family,
          kindName: kind.kindName,
          label: `${kind.family}${kind.kindName}`,
          code,
          start,
          end,
          // UNTDID 2379: a period is given "without hyphen". X12 1250: each range definition
          // gives the format with its hyphen.
          wire: [start, end]
            .map((half) => wireOf(kind.valueKind, code, half))
            .join(kind.standard === "X12" ? "-" : ""),
          expected:
            kind.valueKind === "date"
              ? { start, end }
              : {
                  start: cutDateTime(start, PRECISION[code]),
                  end: cutDateTime(end, PRECISION[code]),
                },
          kind,
        }),
      ),
    ),
  );
}

const VALID_RANGES = rangeRows("forward");
const REVERSED_RANGES = rangeRows("reversed");

/** The first listed exception: an offset that is not whole hours, under a `ZZZ` code. */
const PART_HOUR_UNDER_ZZZ = WHOLE_HOUR_OFFSET_FORMATS.flatMap((code) =>
  OFFSET_DATE_TIMES.filter(({ wholeHour }) => !wholeHour).map(({ value }) => ({
    code,
    value,
  })),
);

/** A value each function writes under its own codes, so the sentinel is for the code. */
const OWN_VALUE: Record<ValueKind, string> = {
  date: "2024-06-15",
  time: "14:30:45",
  dateTime: "2024-06-15T14:30:45",
  offsetDateTime: "2024-06-15T14:30:45+02:00",
};

const count = (rows: { standard: string }[], standard: string): number =>
  rows.filter((row) => row.standard === standard).length;

describe("EDI permutations: a call the types accept returns a value", () => {
  describe("the house values", () => {
    it("each list is in ascending order, so every forward pair has start ≤ end", () => {
      for (let i = 1; i < DATES.length; i++) {
        expect(Temporal.PlainDate.compare(DATES[i - 1], DATES[i])).toBe(-1);
      }
      for (let i = 1; i < DATE_TIMES.length; i++) {
        expect(
          Temporal.PlainDateTime.compare(DATE_TIMES[i - 1], DATE_TIMES[i]),
        ).toBe(-1);
      }
    });

    it("the offsets run from −12:00 to +14:00, with Z and five part-hour offsets", () => {
      expect(WHOLE_HOUR_OFFSETS).toHaveLength(27);
      expect(WHOLE_HOUR_OFFSETS[0]).toBe("-12:00");
      expect(WHOLE_HOUR_OFFSETS[12]).toBe("+00:00");
      expect(WHOLE_HOUR_OFFSETS[26]).toBe("+14:00");
      // 6 wall clocks × (27 whole-hour offsets + 5 part-hour offsets + Z).
      expect(OFFSET_DATE_TIMES).toHaveLength(198);
    });

    it("every mask with a time has a precision, and no other code does", () => {
      const withTime = [
        ...Object.entries(EDIFACT_FORMAT_KINDS),
        ...Object.entries(X12_FORMAT_KINDS),
      ]
        .filter(
          ([, kind]) => !["date", "datePeriod", "dateRange"].includes(kind),
        )
        .map(([code]) => code);
      expect(Object.keys(PRECISION).sort()).toEqual(withTime.sort());
    });
  });

  describe("(a) every valid house value formats to a value that parses back, cut to the mask", () => {
    it.each(VALID_SINGLES)(
      "$label: the formatter writes $value under $code as $wire, and the parser reads it back as $expected",
      ({ kind, code, value, wire, expected }) => {
        expect(kind.format(value, code)).toBe(wire);
        expect(kind.parse(wire, code)).toBe(expected);
        expect(kind.isValid(wire, code)).toBe(true);
      },
    );

    it.each(VALID_RANGES)(
      "$label: the formatter writes $start to $end under $code as $wire, and the parser reads it back as $expected",
      ({ kind, code, start, end, wire, expected }) => {
        expect(kind.format(start, end, code)).toBe(wire);
        expect(kind.parse(wire, code)).toEqual(expected);
        expect(kind.isValid(wire, code)).toBe(true);
      },
    );

    // The counts, so the claim can be quoted: every one of these pairs writes a value.
    it("asserts 789 valid UN/EDIFACT pairs: 4 date, 10 time, 12 date-time, 732 offset date-time, 10 date period and 21 date-time period", () => {
      const FAMILY = "Edifact";
      const of = (kindName: string): number =>
        [...VALID_SINGLES, ...VALID_RANGES].filter(
          (row) => row.family === FAMILY && row.kindName === kindName,
        ).length;
      expect({
        date: of("Date"),
        time: of("Time"),
        dateTime: of("DateTime"),
        offsetDateTime: of("OffsetDateTime"),
        datePeriod: of("DatePeriod"),
        dateTimePeriod: of("DateTimePeriod"),
      }).toEqual({
        // 1 code × 4 dates.
        date: 4,
        // 2 codes × 5 times.
        time: 10,
        // 2 codes × 6 date-times.
        dateTime: 12,
        // 205 and 208: 2 × 198. 303 and 304: 2 × 6 wall clocks × (27 whole hours + Z).
        offsetDateTime: 396 + 336,
        // 1 code × the 10 pairs of 4 dates with start ≤ end.
        datePeriod: 10,
        // 1 code × the 21 pairs of 6 date-times with start ≤ end.
        dateTimePeriod: 21,
      });
      expect(
        count(VALID_SINGLES, "UN/EDIFACT") + count(VALID_RANGES, "UN/EDIFACT"),
      ).toBe(789);
    });

    it("asserts 92 valid X12 pairs: 8 date, 10 time, 12 date-time, 20 date range and 42 date-time range", () => {
      const FAMILY = "X12";
      const of = (kindName: string): number =>
        [...VALID_SINGLES, ...VALID_RANGES].filter(
          (row) => row.family === FAMILY && row.kindName === kindName,
        ).length;
      expect({
        date: of("Date"),
        time: of("Time"),
        dateTime: of("DateTime"),
        dateRange: of("DateRange"),
        dateTimeRange: of("DateTimeRange"),
      }).toEqual({
        // 2 codes × 4 dates.
        date: 8,
        // 2 codes × 5 times.
        time: 10,
        // 2 codes × 6 date-times.
        dateTime: 12,
        // 2 codes × 10 pairs.
        dateRange: 20,
        // 2 codes × 21 pairs.
        dateTimeRange: 42,
      });
      expect(count(VALID_SINGLES, "X12") + count(VALID_RANGES, "X12")).toBe(92);
    });

    it("asserts 881 valid pairs in all", () => {
      expect(VALID_SINGLES.length + VALID_RANGES.length).toBe(881);
    });
  });

  describe("(a) the listed exceptions are sentinels, and nothing else is", () => {
    // `ZZZ` is a signed hour: the field holds hours only. The same value writes under 205 and
    // 208, whose `ZHHMM` holds the minutes.
    it.each(PART_HOUR_UNDER_ZZZ)(
      "formatEdifactOffsetDateTime($value, $code) is '': the offset is not whole hours",
      ({ code, value }) => {
        expect(formatEdifactOffsetDateTime(value, code as never)).toBe("");
        expect(formatEdifactOffsetDateTime(value, "205")).not.toBe("");
        expect(formatEdifactOffsetDateTime(value, "208")).not.toBe("");
      },
    );

    it.each(REVERSED_RANGES)(
      "$label: the formatter returns '' for $start to $end under $code (the end precedes the start), and the parser refuses the same two halves on the wire",
      ({ kind, code, start, end }) => {
        expect(kind.format(start, end, code)).toBe("");
        // The same two values the other way round write.
        const forward = kind.format(end, start, code);
        expect(forward).not.toBe("");
        // The reversed wire value is the forward one with its halves swapped: a UN/EDIFACT
        // period is two halves of equal length run together, an X12 range two halves around
        // its hyphen. Two ends inside one minute of a minute mask are the same digits, which is
        // a period of zero length and not a reversed one.
        const [first, second] =
          kind.standard === "X12"
            ? forward.split("-")
            : [
                forward.slice(0, forward.length / 2),
                forward.slice(forward.length / 2),
              ];
        const separator = kind.standard === "X12" ? "-" : "";
        const reversed = `${second}${separator}${first}`;
        expect(kind.parse(reversed, code) === null).toBe(first !== second);
        expect(kind.isValid(reversed, code)).toBe(first === second);
      },
    );

    it("asserts 60 part-hour offsets under 303 and 304, and 63 reversed periods and ranges", () => {
      // 2 codes × 6 wall clocks × 5 part-hour offsets.
      expect(PART_HOUR_UNDER_ZZZ).toHaveLength(60);
      // UN/EDIFACT: 6 reversed date pairs (718) + 15 reversed date-time pairs (719).
      expect(count(REVERSED_RANGES, "UN/EDIFACT")).toBe(21);
      // X12: 2 × 6 (RD8, RD) + 2 × 15 (RDT, DTS).
      expect(count(REVERSED_RANGES, "X12")).toBe(42);
    });

    // Every valid house value of a kind, under every code of that kind, is in exactly one of the
    // three lists: nothing is left out of the proof.
    it("valid pairs and listed exceptions are every (code, value) pair of every kind", () => {
      const singles = SINGLE_KINDS.reduce(
        (sum, kind) =>
          sum +
          kind.codes.length *
            {
              date: DATES.length,
              time: TIMES.length,
              dateTime: DATE_TIMES.length,
              offsetDateTime: OFFSET_DATE_TIMES.length,
            }[kind.valueKind],
        0,
      );
      expect(VALID_SINGLES.length + PART_HOUR_UNDER_ZZZ.length).toBe(singles);
      const ranges = RANGE_KINDS.reduce(
        (sum, kind) =>
          sum +
          kind.codes.length *
            (kind.valueKind === "date" ? DATES.length : DATE_TIMES.length) ** 2,
        0,
      );
      expect(VALID_RANGES.length + REVERSED_RANGES.length).toBe(ranges);
    });
  });

  describe("(b) every house value of another kind returns the sentinel", () => {
    /** One or more house values of each kind, and strings that are no house value at all. */
    const VALUES_BY_KIND: Record<ValueKind | "none", string[]> = {
      date: DATES,
      time: TIMES,
      dateTime: DATE_TIMES,
      offsetDateTime: DATE_TIMES.flatMap((wall) =>
        ["+02:00", "-05:00", "+05:30", "Z"].map((offset) => `${wall}${offset}`),
      ),
      none: [
        "",
        "2024-06-15/2024-06-20",
        "P1D",
        "+02:00",
        "14:30:00+02:00",
        "20240615",
        "202406151430",
      ],
    };

    const otherKinds = (valueKind: ValueKind): string[] =>
      (Object.keys(VALUES_BY_KIND) as (ValueKind | "none")[])
        .filter((kind) => kind !== valueKind)
        .flatMap((kind) => VALUES_BY_KIND[kind]);

    it.each(
      SINGLE_KINDS.flatMap((kind) =>
        kind.codes.map((code) => ({
          family: kind.family,
          kindName: kind.kindName,
          label: `${kind.family}${kind.kindName}`,
          code,
          kind,
        })),
      ),
    )(
      "$label: the formatter returns '' under $code for every value that is not its kind",
      ({ kind, code }) => {
        for (const value of otherKinds(kind.valueKind)) {
          expect(kind.format(value, code), value).toBe("");
        }
      },
    );

    it.each(
      RANGE_KINDS.flatMap((kind) =>
        kind.codes.map((code) => ({
          family: kind.family,
          kindName: kind.kindName,
          label: `${kind.family}${kind.kindName}`,
          code,
          kind,
        })),
      ),
    )(
      "$label: the formatter returns '' under $code when either end is not its kind",
      ({ kind, code }) => {
        const own = kind.valueKind === "date" ? DATES[2] : DATE_TIMES[2];
        for (const value of otherKinds(kind.valueKind)) {
          expect(kind.format(value, value, code), `both ${value}`).toBe("");
          expect(kind.format(own, value, code), `end ${value}`).toBe("");
          expect(kind.format(value, own, code), `start ${value}`).toBe("");
        }
        expect(kind.format(own, own, code)).not.toBe("");
      },
    );

    it("checks 42 other-kind values against each date function, 41 against each time function, 40 against each date-time function and 22 against each offset function", () => {
      expect({
        date: otherKinds("date").length,
        time: otherKinds("time").length,
        dateTime: otherKinds("dateTime").length,
        offsetDateTime: otherKinds("offsetDateTime").length,
      }).toEqual({ date: 42, time: 41, dateTime: 40, offsetDateTime: 22 });
    });

    // The mirror for the parsers: a wire value written under one code (the digits (a) proves
    // each formatter writes) is read under no other code of its standard.
    const WIRES = [
      ...VALID_SINGLES.map((row) => ({
        standard: row.standard,
        code: row.code,
        wire: row.wire,
      })),
      ...VALID_RANGES.map((row) => ({
        standard: row.standard,
        code: row.code,
        wire: row.wire,
      })),
    ];

    it.each(
      [...SINGLE_KINDS, ...RANGE_KINDS].flatMap((kind) =>
        kind.codes.map((code) => ({
          family: kind.family,
          kindName: kind.kindName,
          label: `${kind.family}${kind.kindName}`,
          code,
          kind,
        })),
      ),
    )(
      "$label: the parser returns the sentinel under $code for every wire value written under another code",
      ({ kind, code }) => {
        const others = WIRES.filter(
          (row) => row.standard === kind.standard && row.code !== code,
        );
        expect(others.length).toBeGreaterThan(0);
        for (const { wire, code: writtenUnder } of others) {
          const parsed: string | EdiPeriod | null = kind.parse(wire, code);
          expect(
            parsed === "" || parsed === null,
            `${wire} (written under ${writtenUnder})`,
          ).toBe(true);
          expect(kind.isValid(wire, code), wire).toBe(false);
        }
      },
    );
  });

  describe("(b) an X12 time is read against its qualifier when it has one, and as element 337 when it has none", () => {
    // Every time the two formatters write, read back three ways. `TM` is `HHMM` and `TS` is
    // `HHMMSS` (X12 1250), so a value written under one is not the other's mask; with no
    // qualifier both are element 337 forms and read.
    const TIME_WIRES = VALID_SINGLES.filter(
      (row) => row.family === "X12" && row.kindName === "Time",
    ).map(({ code, value, wire, expected }) => ({
      code,
      value,
      wire,
      expected,
      other: code === "TM" ? "TS" : "TM",
    }));

    it.each(TIME_WIRES)(
      "$wire (written from $value under $code) reads as $expected under $code and with no qualifier, and is '' under $other",
      ({ code, wire, expected, other }) => {
        expect(parseX12Time(wire, code as never)).toBe(expected);
        expect(parseX12Time(wire)).toBe(expected);
        expect(parseX12Time(wire, other as never)).toBe("");
        expect(isValidX12Time(wire, code as never)).toBe(true);
        expect(isValidX12Time(wire)).toBe(true);
        expect(isValidX12Time(wire, other as never)).toBe(false);
      },
    );

    it("covers the 10 X12 time pairs: 2 qualifiers × 5 times", () => {
      expect(TIME_WIRES).toHaveLength(10);
    });

    // Element 337 also holds tenths (`HHMMSSD`) and hundredths (`HHMMSSDD`), which no 1250 code
    // has: each reads with no qualifier, as the fraction written by hand, and is the sentinel
    // under either qualifier.
    it.each`
      wire          | unqualified
      ${"1430451"}  | ${"14:30:45.1"}
      ${"1430459"}  | ${"14:30:45.9"}
      ${"0000000"}  | ${"00:00:00"}
      ${"14304512"} | ${"14:30:45.12"}
      ${"14300012"} | ${"14:30:00.12"}
      ${"23595999"} | ${"23:59:59.99"}
      ${"00000000"} | ${"00:00:00"}
    `(
      "$wire reads as $unqualified with no qualifier, and is '' under TM and under TS",
      ({ wire, unqualified }) => {
        expect(parseX12Time(wire)).toBe(unqualified);
        expect(isValidX12Time(wire)).toBe(true);
        for (const format of ["TM", "TS"] as const) {
          expect(parseX12Time(wire, format), format).toBe("");
          expect(isValidX12Time(wire, format), format).toBe(false);
        }
      },
    );
  });

  describe("(b) an X12 date and time sent as two elements read together, and neither reads alone", () => {
    // Element 373 is `CCYYMMDD`, the `D8` mask, and element 337 holds `HHMM` and `HHMMSS`, the
    // `TM` and `TS` masks. Each house date-time is written as its two wire values and cut to the
    // mask by plain Temporal; the pair has no qualifier, so there is no code to get wrong.
    it.each`
      code    | mask
      ${"TM"} | ${"HHMM"}
      ${"TS"} | ${"HHMMSS"}
    `(
      "every house date-time, its date as CCYYMMDD and its time as $mask, reads back cut to the mask and is valid",
      ({ code }: { code: string }) => {
        for (const value of DATE_TIMES) {
          const date = dateDigits(value, "D8");
          const time = timeDigits(value, code);
          const expected = Temporal.PlainDateTime.from(value)
            .round({ smallestUnit: PRECISION[code], roundingMode: "trunc" })
            .toString();

          expect(parseX12DateAndTime(date, time), value).toBe(expected);
          expect(isValidX12DateAndTime(date, time), value).toBe(true);
        }
      },
    );

    it.each`
      date          | time       | reads
      ${""}         | ${"1430"}  | ${"no date"}
      ${"20240615"} | ${""}      | ${"no time"}
      ${""}         | ${""}      | ${"neither element"}
      ${"20230229"} | ${"1430"}  | ${"29 February 2023"}
      ${"06152024"} | ${"1430"}  | ${"MMDDCCYY, the DB mask: element 373 is CCYYMMDD"}
      ${"20240615"} | ${"2430"}  | ${"hour 24"}
      ${"20240615"} | ${"14304"} | ${"five digits is not an element 337 form"}
    `(
      "$date and $time ($reads) return '' from the parser and false from the validator",
      ({ date, time }: { date: string; time: string }) => {
        expect(parseX12DateAndTime(date, time)).toBe("");
        expect(isValidX12DateAndTime(date, time)).toBe(false);
      },
    );
  });

  describe("(c) every cut code returns the sentinel from every function", () => {
    const cutCodesOf = (standard: string) =>
      standard === "UN/EDIFACT" ? CUT_EDIFACT_FORMATS : CUT_X12_FORMATS;

    const sentinelOf = (result: unknown): Sentinel | "not a sentinel" =>
      result === "" || result === null ? result : "not a sentinel";

    it.each(
      SINGLE_KINDS.flatMap((kind) =>
        cutCodesOf(kind.standard).map((cut) => ({
          family: kind.family,
          kindName: kind.kindName,
          label: `${kind.family}${kind.kindName}`,
          kind,
          ...cut,
        })),
      ),
    )(
      "$label: the parser, the formatter and the validator refuse the cut code $code ($reads)",
      ({ kind, code, value }) => {
        // The code's own wire value, and a wire value the function reads under its own code.
        const ownWire = kind.format(OWN_VALUE[kind.valueKind], kind.codes[0]);
        expect(ownWire).not.toBe("");
        for (const wire of [value, ownWire]) {
          expect(kind.parse(wire, code), wire).toBe("");
          expect(kind.isValid(wire, code), wire).toBe(false);
        }
        expect(kind.format(OWN_VALUE[kind.valueKind], code)).toBe("");
        // The functions take no options: a year window does not bring a two-digit year back.
        expect(kind.parse(value, code, { yearWindow: 2000 })).toBe("");
        expect(kind.isValid(value, code, { yearWindow: 2000 })).toBe(false);
        expect(
          kind.format(OWN_VALUE[kind.valueKind], code, { yearWindow: 2000 }),
        ).toBe("");
      },
    );

    it.each(
      RANGE_KINDS.flatMap((kind) =>
        cutCodesOf(kind.standard).map((cut) => ({
          family: kind.family,
          kindName: kind.kindName,
          label: `${kind.family}${kind.kindName}`,
          kind,
          ...cut,
        })),
      ),
    )(
      "$label: the parser, the formatter and the validator refuse the cut code $code ($reads)",
      ({ kind, code, value }) => {
        const own = OWN_VALUE[kind.valueKind];
        const ownWire = kind.format(own, own, kind.codes[0]);
        expect(ownWire).not.toBe("");
        for (const wire of [value, ownWire]) {
          expect(sentinelOf(kind.parse(wire, code)), wire).toBeNull();
          expect(kind.isValid(wire, code), wire).toBe(false);
        }
        expect(kind.format(own, own, code)).toBe("");
        expect(kind.parse(value, code, { yearWindow: 2000 })).toBeNull();
        expect(kind.format(own, own, code, { yearWindow: 2000 })).toBe("");
      },
    );

    it.each(CUT_EDIFACT_FORMATS)(
      "classifyEdifactDtmFormat($code) is null and isValidEdifactDtmFormat is false ($reads)",
      ({ code }) => {
        expect(classifyEdifactDtmFormat(code)).toBeNull();
        expect(isValidEdifactDtmFormat(code)).toBe(false);
      },
    );

    it.each(CUT_X12_FORMATS)(
      "classifyX12DateTimePeriodFormat($code) is null and isValidX12DateTimePeriodFormat is false ($reads)",
      ({ code }) => {
        expect(classifyX12DateTimePeriodFormat(code)).toBeNull();
        expect(isValidX12DateTimePeriodFormat(code)).toBe(false);
      },
    );

    it("covers the 12 cut UN/EDIFACT codes and the 11 cut X12 codes", () => {
      expect(CUT_EDIFACT_FORMATS.map(({ code }) => code)).toEqual([
        "101",
        "201",
        "202",
        "206",
        "207",
        "301",
        "302",
        "713",
        "717",
        "209",
        "404",
        "406",
      ]);
      expect(CUT_X12_FORMATS.map(({ code }) => code)).toEqual([
        "D6",
        "TT",
        "TR",
        "RD6",
        "TU",
        "TC",
        "EH",
        "DDT",
        "DTD",
        "RTM",
        "UN",
      ]);
    });
  });

  describe("(d) the classifiers agree with the per-kind unions", () => {
    it.each(
      Object.entries(EDIFACT_FORMAT_KINDS).map(([code, kind]) => ({
        code,
        kind,
      })),
    )(
      "classifyEdifactDtmFormat($code) is the kind $kind with the code $code, and only the $kind functions read it",
      ({ code, kind }) => {
        expect(classifyEdifactDtmFormat(code)).toEqual({ kind, format: code });
        expect(isValidEdifactDtmFormat(code)).toBe(true);
        for (const fns of [...SINGLE_KINDS, ...RANGE_KINDS].filter(
          ({ standard }) => standard === "UN/EDIFACT",
        )) {
          expect(fns.codes.includes(code), fns.kindName).toBe(
            `${kind[0].toUpperCase()}${kind.slice(1)}` === fns.kindName,
          );
        }
      },
    );

    it.each(
      Object.entries(X12_FORMAT_KINDS).map(([code, kind]) => ({ code, kind })),
    )(
      "classifyX12DateTimePeriodFormat($code) is the kind $kind with the code $code, and only the $kind functions read it",
      ({ code, kind }) => {
        expect(classifyX12DateTimePeriodFormat(code)).toEqual({
          kind,
          format: code,
        });
        expect(isValidX12DateTimePeriodFormat(code)).toBe(true);
        for (const fns of [...SINGLE_KINDS, ...RANGE_KINDS].filter(
          ({ standard }) => standard === "X12",
        )) {
          expect(fns.codes.includes(code), fns.kindName).toBe(
            `${kind[0].toUpperCase()}${kind.slice(1)}` === fns.kindName,
          );
        }
      },
    );

    // The narrowed code is the one each kind's functions take: the classifier's `format`, passed
    // on as it is, writes the kind's own value and reads it back.
    it.each(
      [
        ...SINGLE_KINDS.map((kind) => ({
          kind,
          write: (code: string) => kind.format(OWN_VALUE[kind.valueKind], code),
        })),
        ...RANGE_KINDS.map((kind) => ({
          kind,
          write: (code: string) =>
            kind.format(
              OWN_VALUE[kind.valueKind],
              OWN_VALUE[kind.valueKind],
              code,
            ),
        })),
      ].flatMap(({ kind, write }) =>
        kind.codes.map((code) => ({
          label: `${kind.family}${kind.kindName}`,
          code,
          kind,
          write,
        })),
      ),
    )(
      "$label: the code $code, as its classifier returns it, is one the kind's functions read",
      ({ kind, code, write }) => {
        const classified =
          kind.standard === "UN/EDIFACT"
            ? classifyEdifactDtmFormat(code)
            : classifyX12DateTimePeriodFormat(code);
        expect(classified?.format).toBe(code);
        expect(
          `${classified?.kind[0].toUpperCase()}${classified?.kind.slice(1)}`,
        ).toBe(kind.kindName);
        const narrowed = classified?.format ?? "";
        const wire = write(narrowed);
        expect(wire).not.toBe("");
        expect(kind.isValid(wire, narrowed)).toBe(true);
      },
    );

    // A string that is not a supported code is null from both: the other standard's codes, the
    // time codes of element 623, and strings that are no code at all.
    it.each`
      code             | reads
      ${"D8"}          | ${"an X12 code, to the UN/EDIFACT classifier"}
      ${"602"}         | ${"a 2379 code that is not read"}
      ${"ET"}          | ${"a 623 time code"}
      ${""}            | ${"an empty string"}
      ${" 102"}        | ${"a leading space"}
      ${"__proto__"}   | ${"an inherited property name"}
      ${"constructor"} | ${"an inherited property name"}
    `("classifyEdifactDtmFormat('$code') is null ($reads)", ({ code }) => {
      expect(classifyEdifactDtmFormat(code)).toBeNull();
    });

    it.each`
      code             | reads
      ${"102"}         | ${"a UN/EDIFACT code, to the X12 classifier"}
      ${"CM"}          | ${"a 1250 code that is not read"}
      ${"ET"}          | ${"a 623 time code"}
      ${"d8"}          | ${"lower case"}
      ${""}            | ${"an empty string"}
      ${"__proto__"}   | ${"an inherited property name"}
      ${"constructor"} | ${"an inherited property name"}
    `(
      "classifyX12DateTimePeriodFormat('$code') is null ($reads)",
      ({ code }) => {
        expect(classifyX12DateTimePeriodFormat(code)).toBeNull();
      },
    );

    describe("classifyX12TimeCode covers the 56 codes of element 623", () => {
      const rows = X12_TIME_CODES.map((timeCode) => ({
        timeCode,
        definition: X12_TIME_CODE_EXPECTATIONS[timeCode].definition,
        // The matrix states an offset for a code whose definition is an ISO designator, `UT` or
        // `GM`, and a zone for a code whose definition is a zone name.
        kind:
          "offset" in X12_TIME_CODE_EXPECTATIONS[timeCode] ? "offset" : "zone",
      }));

      it.each(rows)(
        "classifyX12TimeCode($timeCode) is the kind $kind with the code $timeCode ($definition), and its reader returns a value",
        ({ timeCode, kind }) => {
          const classified = classifyX12TimeCode(timeCode);
          expect(classified).toEqual({ kind, timeCode });
          expect(isValidX12TimeCode(timeCode)).toBe(true);
          // No cast: testing `kind` narrows `timeCode` to the reader's own union.
          if (classified?.kind === "offset") {
            expect(x12TimeCodeOffset(classified.timeCode)).not.toBe("");
          } else if (classified?.kind === "zone") {
            expect(x12TimeCodeZone(classified.timeCode)).not.toBeNull();
          }
        },
      );

      it("31 offset codes and 25 zone codes: 56 in all", () => {
        expect(rows.filter(({ kind }) => kind === "offset")).toHaveLength(31);
        expect(rows.filter(({ kind }) => kind === "zone")).toHaveLength(25);
        expect(rows).toHaveLength(56);
      });

      it.each`
        timeCode       | reads
        ${"30"}        | ${"above the numeric run"}
        ${"00"}        | ${"below the numeric run"}
        ${"EST"}       | ${"an abbreviation"}
        ${"et"}        | ${"lower case"}
        ${"D8"}        | ${"a 1250 format code"}
        ${"DT"}        | ${"a 1250 format code"}
        ${"102"}       | ${"a 2379 format code"}
        ${""}          | ${"an empty string"}
        ${"__proto__"} | ${"an inherited property name"}
      `(
        "classifyX12TimeCode('$timeCode') is null and isValidX12TimeCode is false ($reads)",
        ({ timeCode }) => {
          expect(classifyX12TimeCode(timeCode)).toBeNull();
          expect(isValidX12TimeCode(timeCode)).toBe(false);
        },
      );
    });

    it("11 UN/EDIFACT codes and 10 X12 codes are classified, each under one kind", () => {
      expect(Object.keys(EDIFACT_FORMAT_KINDS)).toHaveLength(11);
      expect(Object.keys(X12_FORMAT_KINDS)).toHaveLength(10);
      const edifact = [...SINGLE_KINDS, ...RANGE_KINDS]
        .filter(({ standard }) => standard === "UN/EDIFACT")
        .flatMap(({ codes }) => codes);
      const x12 = [...SINGLE_KINDS, ...RANGE_KINDS]
        .filter(({ standard }) => standard === "X12")
        .flatMap(({ codes }) => codes);
      expect([...edifact].sort()).toEqual(
        Object.keys(EDIFACT_FORMAT_KINDS).sort(),
      );
      expect([...x12].sort()).toEqual(Object.keys(X12_FORMAT_KINDS).sort());
    });
  });

  describe("the functions take no options argument", () => {
    // `Function.prototype.length` is the number of declared parameters: a value and a code, two
    // ends and a code, or the one or two elements a function reads.
    it.each`
      name                                 | fn                                 | parameters
      ${"parseEdifactDate"}                | ${parseEdifactDate}                | ${2}
      ${"parseEdifactTime"}                | ${parseEdifactTime}                | ${2}
      ${"parseEdifactDateTime"}            | ${parseEdifactDateTime}            | ${2}
      ${"parseEdifactOffsetDateTime"}      | ${parseEdifactOffsetDateTime}      | ${2}
      ${"parseEdifactDatePeriod"}          | ${parseEdifactDatePeriod}          | ${2}
      ${"parseEdifactDateTimePeriod"}      | ${parseEdifactDateTimePeriod}      | ${2}
      ${"formatEdifactDate"}               | ${formatEdifactDate}               | ${2}
      ${"formatEdifactTime"}               | ${formatEdifactTime}               | ${2}
      ${"formatEdifactDateTime"}           | ${formatEdifactDateTime}           | ${2}
      ${"formatEdifactOffsetDateTime"}     | ${formatEdifactOffsetDateTime}     | ${2}
      ${"formatEdifactDatePeriod"}         | ${formatEdifactDatePeriod}         | ${3}
      ${"formatEdifactDateTimePeriod"}     | ${formatEdifactDateTimePeriod}     | ${3}
      ${"isValidEdifactDate"}              | ${isValidEdifactDate}              | ${2}
      ${"isValidEdifactTime"}              | ${isValidEdifactTime}              | ${2}
      ${"isValidEdifactDateTime"}          | ${isValidEdifactDateTime}          | ${2}
      ${"isValidEdifactOffsetDateTime"}    | ${isValidEdifactOffsetDateTime}    | ${2}
      ${"isValidEdifactDatePeriod"}        | ${isValidEdifactDatePeriod}        | ${2}
      ${"isValidEdifactDateTimePeriod"}    | ${isValidEdifactDateTimePeriod}    | ${2}
      ${"parseX12Date"}                    | ${parseX12Date}                    | ${2}
      ${"parseX12Time"}                    | ${parseX12Time}                    | ${2}
      ${"parseX12DateTime"}                | ${parseX12DateTime}                | ${2}
      ${"parseX12DateRange"}               | ${parseX12DateRange}               | ${2}
      ${"parseX12DateTimeRange"}           | ${parseX12DateTimeRange}           | ${2}
      ${"parseX12DateAndTime"}             | ${parseX12DateAndTime}             | ${2}
      ${"formatX12Date"}                   | ${formatX12Date}                   | ${2}
      ${"formatX12Time"}                   | ${formatX12Time}                   | ${2}
      ${"formatX12DateTime"}               | ${formatX12DateTime}               | ${2}
      ${"formatX12DateRange"}              | ${formatX12DateRange}              | ${3}
      ${"formatX12DateTimeRange"}          | ${formatX12DateTimeRange}          | ${3}
      ${"isValidX12Date"}                  | ${isValidX12Date}                  | ${2}
      ${"isValidX12Time"}                  | ${isValidX12Time}                  | ${2}
      ${"isValidX12DateTime"}              | ${isValidX12DateTime}              | ${2}
      ${"isValidX12DateAndTime"}           | ${isValidX12DateAndTime}           | ${2}
      ${"isValidX12DateRange"}             | ${isValidX12DateRange}             | ${2}
      ${"isValidX12DateTimeRange"}         | ${isValidX12DateTimeRange}         | ${2}
      ${"x12TimeCodeOffset"}               | ${x12TimeCodeOffset}               | ${1}
      ${"x12TimeCodeZone"}                 | ${x12TimeCodeZone}                 | ${1}
      ${"classifyEdifactDtmFormat"}        | ${classifyEdifactDtmFormat}        | ${1}
      ${"classifyX12DateTimePeriodFormat"} | ${classifyX12DateTimePeriodFormat} | ${1}
      ${"classifyX12TimeCode"}             | ${classifyX12TimeCode}             | ${1}
    `("$name declares $parameters parameters", ({ fn, parameters }) => {
      expect((fn as (...args: unknown[]) => unknown).length).toBe(parameters);
    });
  });
});
