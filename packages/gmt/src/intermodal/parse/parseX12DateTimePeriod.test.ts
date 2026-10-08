import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { X12_DATE_TIME_PERIOD_FORMATS } from "../../internal";
import {
  mockTemporalNowInstantThrow,
  mockTemporalPlainDateFromThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import type {
  EdiDateTime,
  EdiPeriodEnd,
  X12DateTimePeriodFormat,
} from "../../types/edi";
import { parseX12DateTimePeriod } from "./parseX12DateTimePeriod";

/**
 * Every expected value below is read off the code's mask by hand: the `mask` column is the
 * format X12 data element 1250 gives for the code (release 005010, Stedi's X12-licensed
 * dictionary), and the value's digits are placed under it. `expectIso` then re-reads each ISO
 * member of the expected result through plain Temporal with `overflow: "reject"`, so an expected
 * value that is not a real, canonically written date, time or date-time fails before the
 * function is asked.
 *
 * The digit-level grammar of each mask (a month 13, a colon, a stray space) is asserted once, in
 * `internal/ediGrammar.test.ts`. This file holds one row per code and the behaviour the public
 * function adds or documents.
 */
function expectIso(expected: EdiDateTime | EdiPeriodEnd): void {
  if (expected.date !== undefined) {
    expect(
      Temporal.PlainDate.from(expected.date, { overflow: "reject" }).toString(),
    ).toBe(expected.date);
  }
  if (expected.time !== undefined) {
    expect(
      Temporal.PlainTime.from(expected.time, { overflow: "reject" }).toString(),
    ).toBe(expected.time);
  }
  if (expected.local !== undefined) {
    expect(
      Temporal.PlainDateTime.from(expected.local, {
        overflow: "reject",
      }).toString(),
    ).toBe(expected.local);
  }
  if ("periodEnd" in expected && expected.periodEnd !== undefined) {
    expectIso(expected.periodEnd);
  }
}

const WINDOW_2000 = { yearWindow: 2000 };

/**
 * Values that are not strings, each named for the failure message. Built per use: a Proxy that
 * throws on every trap reaches the catch path, where the others stop at the `typeof` guard.
 */
const NON_STRINGS: [string, () => unknown][] = [
  ["null", () => null],
  ["undefined", () => undefined],
  ["a number", () => 20240615],
  ["a boolean", () => true],
  ["an array holding a string", () => ["20240615"]],
  ["an object", () => ({})],
  ["a Proxy that throws on any trap", hostileProxy],
  ["a revoked Proxy", revokedProxy],
];

/** A getter that throws, for an options bag that cannot be read. */
function throwing(): never {
  throw new Error("hostile getter");
}

/**
 * One row per code GMT reads, keyed by the code union so that a code with no row fails
 * typecheck (`UN` has no mask and its own block below). `mask` is the format X12 data element
 * 1250 gives for the code. `value` is 15 June 2024 at 14:30 (:45 where the mask has `SS`) placed
 * under it, or day 166 for an ordinal code; `expected` is that value read back off the mask by
 * hand, with a two-digit year in 2000–2099. `neighbour` is the code whose mask is nearest: a
 * code filed under its neighbour's layout, or a mask one field too long or too short, fails here.
 */
const CODE_ROWS: Record<
  Exclude<X12DateTimePeriodFormat, "UN">,
  {
    mask: string;
    value: string;
    expected: EdiDateTime;
    neighbour: X12DateTimePeriodFormat;
  }
> = {
  D8: {
    mask: "CCYYMMDD",
    value: "20240615",
    expected: { date: "2024-06-15" },
    neighbour: "D6",
  },
  D6: {
    mask: "YYMMDD",
    value: "240615",
    expected: { date: "2024-06-15" },
    neighbour: "D8",
  },
  DB: {
    mask: "MMDDCCYY",
    value: "06152024",
    expected: { date: "2024-06-15" },
    neighbour: "D8",
  },
  TT: {
    mask: "MMDDYY",
    value: "061524",
    expected: { date: "2024-06-15" },
    neighbour: "D6",
  },
  DT: {
    mask: "CCYYMMDDHHMM",
    value: "202406151430",
    expected: { local: "2024-06-15T14:30:00" },
    neighbour: "RTS",
  },
  TR: {
    mask: "DDMMYYHHMM",
    value: "1506241430",
    expected: { local: "2024-06-15T14:30:00" },
    neighbour: "DT",
  },
  RTS: {
    mask: "CCYYMMDDHHMMSS",
    value: "20240615143045",
    expected: { local: "2024-06-15T14:30:45" },
    neighbour: "DT",
  },
  TM: {
    mask: "HHMM",
    value: "1430",
    expected: { time: "14:30:00" },
    neighbour: "TS",
  },
  TS: {
    mask: "HHMMSS",
    value: "143045",
    expected: { time: "14:30:45" },
    neighbour: "TM",
  },
  RD8: {
    mask: "CCYYMMDD-CCYYMMDD",
    value: "20240615-20240620",
    expected: { date: "2024-06-15", periodEnd: { date: "2024-06-20" } },
    neighbour: "RD6",
  },
  RD6: {
    mask: "YYMMDD-YYMMDD",
    value: "240615-240620",
    expected: { date: "2024-06-15", periodEnd: { date: "2024-06-20" } },
    neighbour: "RD8",
  },
  RD: {
    mask: "MMDDCCYY-MMDDCCYY",
    value: "06152024-06202024",
    expected: { date: "2024-06-15", periodEnd: { date: "2024-06-20" } },
    neighbour: "RD8",
  },
  RDT: {
    mask: "CCYYMMDDHHMM-CCYYMMDDHHMM",
    value: "202406151430-202406201600",
    expected: {
      local: "2024-06-15T14:30:00",
      periodEnd: { local: "2024-06-20T16:00:00" },
    },
    neighbour: "DTS",
  },
  DTS: {
    mask: "CCYYMMDDHHMMSS-CCYYMMDDHHMMSS",
    value: "20240615143045-20240620160000",
    expected: {
      local: "2024-06-15T14:30:45",
      periodEnd: { local: "2024-06-20T16:00:00" },
    },
    neighbour: "RDT",
  },
  DDT: {
    mask: "CCYYMMDD-CCYYMMDDHHMM",
    value: "20240615-202406201600",
    expected: {
      date: "2024-06-15",
      periodEnd: { local: "2024-06-20T16:00:00" },
    },
    neighbour: "DTD",
  },
  DTD: {
    mask: "CCYYMMDDHHMM-CCYYMMDD",
    value: "202406151430-20240620",
    expected: {
      local: "2024-06-15T14:30:00",
      periodEnd: { date: "2024-06-20" },
    },
    neighbour: "DDT",
  },
  RTM: {
    mask: "HHMM-HHMM",
    value: "0900-1700",
    expected: { time: "09:00:00", periodEnd: { time: "17:00:00" } },
    neighbour: "TM",
  },
  TC: {
    mask: "DDD",
    value: "166",
    expected: { dayOfYear: 166 },
    neighbour: "EH",
  },
  TU: {
    mask: "YYDDD",
    value: "24166",
    expected: { date: "2024-06-14", dayOfYear: 166 },
    neighbour: "EH",
  },
  EH: {
    mask: "YDDD",
    value: "4166",
    expected: { yearDigit: 4, dayOfYear: 166 },
    neighbour: "TU",
  },
};

describe("parseX12DateTimePeriod", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setNow(instant: string): void {
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(
      Temporal.Instant.from(instant),
    );
  }

  describe("every 1250 code GMT reads takes its own mask and no other", () => {
    it.each(
      X12_DATE_TIME_PERIOD_FORMATS.filter(
        (code): code is Exclude<X12DateTimePeriodFormat, "UN"> => code !== "UN",
      ).map((formatQualifier) => ({
        formatQualifier,
        ...CODE_ROWS[formatQualifier],
      })),
    )(
      "$formatQualifier ($mask) reads $value as $expected, and not one character short or long, nor under $neighbour",
      ({ formatQualifier, value, expected, neighbour }) => {
        expectIso(expected);
        expect(
          parseX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).toStrictEqual(expected);
        expect(
          parseX12DateTimePeriod(
            value.slice(0, -1),
            formatQualifier,
            WINDOW_2000,
          ),
        ).toBeNull();
        expect(
          parseX12DateTimePeriod(`${value}0`, formatQualifier, WINDOW_2000),
        ).toBeNull();
        expect(
          parseX12DateTimePeriod(value, neighbour, WINDOW_2000),
        ).toBeNull();
      },
    );

    // The masks put the year first, the month first or the day first, so one run of digits is a
    // different date under each code: the code is what tells them apart. 10112012 is 11 October
    // 2012 month-first and names no date year-first (month 20); 101112 is 12 November 2010
    // year-first and 11 October 2012 month-first.
    it.each`
      value         | first   | readsFirst                | second  | readsSecond
      ${"10112012"} | ${"DB"} | ${{ date: "2012-10-11" }} | ${"D8"} | ${null}
      ${"101112"}   | ${"D6"} | ${{ date: "2010-11-12" }} | ${"TT"} | ${{ date: "2012-10-11" }}
    `(
      "reads $value as $readsFirst under $first and as $readsSecond under $second",
      ({ value, first, readsFirst, second, readsSecond }) => {
        expect(parseX12DateTimePeriod(value, first, WINDOW_2000)).toStrictEqual(
          readsFirst,
        );
        expect(
          parseX12DateTimePeriod(value, second, WINDOW_2000),
        ).toStrictEqual(readsSecond);
      },
    );
  });

  describe("date codes with a four-digit year return `date`", () => {
    it.each`
      formatQualifier | mask          | value         | expected
      ${"D8"}         | ${"CCYYMMDD"} | ${"20240229"} | ${{ date: "2024-02-29" }}
      ${"D8"}         | ${"CCYYMMDD"} | ${"20241231"} | ${{ date: "2024-12-31" }}
      ${"D8"}         | ${"CCYYMMDD"} | ${"00000101"} | ${{ date: "0000-01-01" }}
      ${"D8"}         | ${"CCYYMMDD"} | ${"00010101"} | ${{ date: "0001-01-01" }}
      ${"D8"}         | ${"CCYYMMDD"} | ${"99991231"} | ${{ date: "9999-12-31" }}
      ${"DB"}         | ${"MMDDCCYY"} | ${"02292024"} | ${{ date: "2024-02-29" }}
      ${"DB"}         | ${"MMDDCCYY"} | ${"12312024"} | ${{ date: "2024-12-31" }}
      ${"DB"}         | ${"MMDDCCYY"} | ${"01010000"} | ${{ date: "0000-01-01" }}
      ${"DB"}         | ${"MMDDCCYY"} | ${"12319999"} | ${{ date: "9999-12-31" }}
    `(
      "reads $value under $formatQualifier ($mask) as $expected",
      ({ formatQualifier, value, expected }) => {
        expectIso(expected);
        expect(parseX12DateTimePeriod(value, formatQualifier)).toStrictEqual(
          expected,
        );
      },
    );
  });

  describe("date-time codes with a four-digit year return `local` and no instant", () => {
    it.each`
      formatQualifier | mask                | value               | expected
      ${"DT"}         | ${"CCYYMMDDHHMM"}   | ${"202402290000"}   | ${{ local: "2024-02-29T00:00:00" }}
      ${"DT"}         | ${"CCYYMMDDHHMM"}   | ${"202412312359"}   | ${{ local: "2024-12-31T23:59:00" }}
      ${"RTS"}        | ${"CCYYMMDDHHMMSS"} | ${"20240615143000"} | ${{ local: "2024-06-15T14:30:00" }}
      ${"RTS"}        | ${"CCYYMMDDHHMMSS"} | ${"20241231235959"} | ${{ local: "2024-12-31T23:59:59" }}
    `(
      "reads $value under $formatQualifier ($mask) as $expected",
      ({ formatQualifier, value, expected }) => {
        expectIso(expected);
        expect(parseX12DateTimePeriod(value, formatQualifier)).toStrictEqual(
          expected,
        );
      },
    );

    // No 1250 code carries an offset, so no result states an instant, an offset or a zone: the
    // segment's 623 time code says where the clock was.
    it.each`
      formatQualifier | value
      ${"DT"}         | ${"202406151430"}
      ${"RTS"}        | ${"20240615143000"}
      ${"TR"}         | ${"1506241430"}
    `(
      "$formatQualifier $value carries no instant, offset or zone",
      ({ formatQualifier, value }) => {
        const result = parseX12DateTimePeriod(
          value,
          formatQualifier,
          WINDOW_2000,
        );
        expect(result).not.toBeNull();
        expect(result).not.toHaveProperty("instant");
        expect(result).not.toHaveProperty("offset");
        expect(result).not.toHaveProperty("zone");
      },
    );

    it("reads RTS as one date-time, not a range, despite the R", () => {
      const result = parseX12DateTimePeriod("20240615143000", "RTS");
      expect(result).toStrictEqual({ local: "2024-06-15T14:30:00" });
      expect(result).not.toHaveProperty("periodEnd");
      expect(
        parseX12DateTimePeriod("20240615143000-20240620160000", "RTS"),
      ).toBeNull();
    });
  });

  describe("time codes return `time`", () => {
    it.each`
      formatQualifier | mask        | value       | expected
      ${"TM"}         | ${"HHMM"}   | ${"0000"}   | ${{ time: "00:00:00" }}
      ${"TM"}         | ${"HHMM"}   | ${"2359"}   | ${{ time: "23:59:00" }}
      ${"TS"}         | ${"HHMMSS"} | ${"120000"} | ${{ time: "12:00:00" }}
      ${"TS"}         | ${"HHMMSS"} | ${"235959"} | ${{ time: "23:59:59" }}
    `(
      "reads $value under $formatQualifier ($mask) as $expected",
      ({ formatQualifier, value, expected }) => {
        expectIso(expected);
        expect(parseX12DateTimePeriod(value, formatQualifier)).toStrictEqual(
          expected,
        );
      },
    );
  });

  describe("range codes return the start and `periodEnd`", () => {
    it.each`
      formatQualifier | mask                   | value                  | expected
      ${"RD8"}        | ${"CCYYMMDD-CCYYMMDD"} | ${"20240229-20240301"} | ${{ date: "2024-02-29", periodEnd: { date: "2024-03-01" } }}
      ${"RD8"}        | ${"CCYYMMDD-CCYYMMDD"} | ${"20241231-20250101"} | ${{ date: "2024-12-31", periodEnd: { date: "2025-01-01" } }}
      ${"RD"}         | ${"MMDDCCYY-MMDDCCYY"} | ${"12312024-01012025"} | ${{ date: "2024-12-31", periodEnd: { date: "2025-01-01" } }}
      ${"RTM"}        | ${"HHMM-HHMM"}         | ${"0000-2359"}         | ${{ time: "00:00:00", periodEnd: { time: "23:59:00" } }}
    `(
      "reads $value under $formatQualifier ($mask) as $expected",
      ({ formatQualifier, value, expected }) => {
        expectIso(expected);
        expect(parseX12DateTimePeriod(value, formatQualifier)).toStrictEqual(
          expected,
        );
      },
    );

    it("reads DTS as a range despite having no R", () => {
      expect(parseX12DateTimePeriod("20240615143045", "DTS")).toBeNull();
      expect(
        parseX12DateTimePeriod("20240615143045-20240620160000", "DTS"),
      ).toHaveProperty("periodEnd");
    });

    // An end equal to its start is a zero-length range, not a reversed one. A date compared with
    // a date-time compares by calendar date, since X12 gives the date no time of day.
    it.each`
      formatQualifier | value                              | expected
      ${"RD8"}        | ${"20240615-20240615"}             | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-15" } }}
      ${"RD"}         | ${"06152024-06152024"}             | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-15" } }}
      ${"RDT"}        | ${"202406151430-202406151430"}     | ${{ local: "2024-06-15T14:30:00", periodEnd: { local: "2024-06-15T14:30:00" } }}
      ${"DTS"}        | ${"20240615143045-20240615143045"} | ${{ local: "2024-06-15T14:30:45", periodEnd: { local: "2024-06-15T14:30:45" } }}
      ${"DDT"}        | ${"20240615-202406150000"}         | ${{ date: "2024-06-15", periodEnd: { local: "2024-06-15T00:00:00" } }}
      ${"DTD"}        | ${"202406152359-20240615"}         | ${{ local: "2024-06-15T23:59:00", periodEnd: { date: "2024-06-15" } }}
      ${"RTM"}        | ${"0900-0900"}                     | ${{ time: "09:00:00", periodEnd: { time: "09:00:00" } }}
    `(
      "reads $formatQualifier $value, whose end is on its start, as $expected",
      ({ formatQualifier, value, expected }) => {
        expectIso(expected);
        expect(parseX12DateTimePeriod(value, formatQualifier)).toStrictEqual(
          expected,
        );
      },
    );
  });

  describe("an X12 range is transmitted with its hyphen", () => {
    // X12 data element 1250 gives each range with its hyphen ("Range of Dates Expressed in Format
    // CCYYMMDD-CCYYMMDD") and has no instruction to leave it out, so a range has exactly one.
    // UN/EDIFACT sends a period with none; X12 does not.
    it.each`
      formatQualifier | start               | end
      ${"RD8"}        | ${"20240615"}       | ${"20240620"}
      ${"RD6"}        | ${"240615"}         | ${"240620"}
      ${"RD"}         | ${"06152024"}       | ${"06202024"}
      ${"RDT"}        | ${"202406151430"}   | ${"202406201600"}
      ${"DTS"}        | ${"20240615143045"} | ${"20240620160000"}
      ${"DDT"}        | ${"20240615"}       | ${"202406201600"}
      ${"DTD"}        | ${"202406151430"}   | ${"20240620"}
      ${"RTM"}        | ${"0900"}           | ${"1700"}
    `(
      "reads $formatQualifier $start-$end with its one hyphen, and returns null with none and with two",
      ({ formatQualifier, start, end }) => {
        expect(
          parseX12DateTimePeriod(
            `${start}-${end}`,
            formatQualifier,
            WINDOW_2000,
          ),
        ).not.toBeNull();
        expect(
          parseX12DateTimePeriod(
            `${start}${end}`,
            formatQualifier,
            WINDOW_2000,
          ),
        ).toBeNull();
        expect(
          parseX12DateTimePeriod(
            `${start}--${end}`,
            formatQualifier,
            WINDOW_2000,
          ),
        ).toBeNull();
      },
    );

    it.each`
      value                    | reads
      ${"20240615 20240620"}   | ${"a space"}
      ${"20240615–20240620"}   | ${"an en dash"}
      ${"20240615 - 20240620"} | ${"a spaced hyphen"}
      ${"20240615-"}           | ${"a start and a hyphen with no end"}
      ${"-20240620"}           | ${"an end with no start"}
    `("returns null for RD8 $value ($reads)", ({ value }) => {
      expect(parseX12DateTimePeriod(value, "RD8")).toBeNull();
    });
  });

  describe("two-digit-year codes need the caller's yearWindow", () => {
    // 2000 reads 00–99 as 2000–2099. 1950 reads 50–99 as 1950–1999 and 00–49 as 2000–2049.
    it.each`
      formatQualifier | mask               | value              | yearWindow | expected
      ${"D6"}         | ${"YYMMDD"}        | ${"240615"}        | ${1950}    | ${{ date: "2024-06-15" }}
      ${"D6"}         | ${"YYMMDD"}        | ${"990615"}        | ${2000}    | ${{ date: "2099-06-15" }}
      ${"D6"}         | ${"YYMMDD"}        | ${"990615"}        | ${1950}    | ${{ date: "1999-06-15" }}
      ${"D6"}         | ${"YYMMDD"}        | ${"500101"}        | ${1950}    | ${{ date: "1950-01-01" }}
      ${"D6"}         | ${"YYMMDD"}        | ${"491231"}        | ${1950}    | ${{ date: "2049-12-31" }}
      ${"D6"}         | ${"YYMMDD"}        | ${"000229"}        | ${2000}    | ${{ date: "2000-02-29" }}
      ${"TT"}         | ${"MMDDYY"}        | ${"061599"}        | ${1950}    | ${{ date: "1999-06-15" }}
      ${"TR"}         | ${"DDMMYYHHMM"}    | ${"1506991430"}    | ${1950}    | ${{ local: "1999-06-15T14:30:00" }}
      ${"RD6"}        | ${"YYMMDD-YYMMDD"} | ${"991231-000101"} | ${1950}    | ${{ date: "1999-12-31", periodEnd: { date: "2000-01-01" } }}
      ${"TU"}         | ${"YYDDD"}         | ${"99166"}         | ${1950}    | ${{ date: "1999-06-15", dayOfYear: 166 }}
    `(
      "reads $value under $formatQualifier ($mask) with yearWindow $yearWindow as $expected",
      ({ formatQualifier, value, yearWindow, expected }) => {
        expectIso(expected);
        expect(
          parseX12DateTimePeriod(value, formatQualifier, { yearWindow }),
        ).toStrictEqual(expected);
      },
    );

    // The same range read in two windows: 99 then 00 crosses a century in 1950–2049, and runs
    // backwards, 2099 to 2000, in 2000–2099.
    it("returns null for RD6 991231-000101 with yearWindow 2000: the end precedes the start", () => {
      expect(
        parseX12DateTimePeriod("991231-000101", "RD6", WINDOW_2000),
      ).toBeNull();
    });

    it.each`
      formatQualifier | value
      ${"D6"}         | ${"240615"}
      ${"TT"}         | ${"061524"}
      ${"TR"}         | ${"1506241430"}
      ${"RD6"}        | ${"240615-240620"}
      ${"TU"}         | ${"24166"}
    `(
      "returns null for $formatQualifier $value without a window, and a value with one",
      ({ formatQualifier, value }) => {
        expect(parseX12DateTimePeriod(value, formatQualifier)).toBeNull();
        expect(
          parseX12DateTimePeriod(value, formatQualifier, undefined),
        ).toBeNull();
        expect(parseX12DateTimePeriod(value, formatQualifier, {})).toBeNull();
        expect(
          parseX12DateTimePeriod(value, formatQualifier, {
            yearWindow: undefined,
          }),
        ).toBeNull();
        expect(
          parseX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).not.toBeNull();
      },
    );

    it.each`
      yearWindow                  | reads
      ${null}                     | ${"null"}
      ${"2000"}                   | ${"a numeric string"}
      ${"Rolling"}                | ${"rolling in another case"}
      ${"sliding"}                | ${"an unknown name"}
      ${1999.5}                   | ${"a non-integer"}
      ${-1}                       | ${"below 0"}
      ${9901}                     | ${"above 9900: the window would pass year 9999"}
      ${Number.NaN}               | ${"NaN"}
      ${Number.POSITIVE_INFINITY} | ${"Infinity"}
      ${true}                     | ${"a boolean"}
      ${[2000]}                   | ${"an array holding a year"}
    `(
      "returns null for D6 240615 with yearWindow $yearWindow ($reads)",
      ({ yearWindow }) => {
        expect(
          parseX12DateTimePeriod("240615", "D6", { yearWindow } as never),
        ).toBeNull();
      },
    );

    // V13 of the story: a TU value needs the window whether or not its day exists in the year.
    it("returns null for TU 24366 and TU 23366 without a window", () => {
      expect(parseX12DateTimePeriod("24366", "TU")).toBeNull();
      expect(parseX12DateTimePeriod("23366", "TU")).toBeNull();
    });

    it.each`
      yearWindow | expected
      ${0}       | ${{ date: "0024-06-15" }}
      ${-0}      | ${{ date: "0024-06-15" }}
      ${9900}    | ${{ date: "9924-06-15" }}
    `(
      "reads D6 240615 at the window limit $yearWindow as $expected",
      ({ yearWindow, expected }) => {
        expectIso(expected);
        expect(
          parseX12DateTimePeriod("240615", "D6", { yearWindow }),
        ).toStrictEqual(expected);
      },
    );

    // GMT rule: "rolling" is 50 years before the current UTC calendar year to 49 after it. On
    // 2026-10-07 and 2049-12-31 that is 1976–2075 and 1999–2098, so 99 is 1999; on 2050-01-01 it
    // is 2000–2099, so 99 is 2099. A fixed window reads the same value the same way on all three.
    // The last two rows are instants whose local date and UTC date fall in different years: the
    // UTC year decides. (CI runs this suite under ten system time zones, so a rule that read the
    // system zone's year fails there on the rows at the UTC new year.)
    it.each`
      now                            | window                                                                                 | expected
      ${"2026-10-07T12:00:00Z"}      | ${"1976–2075"}                                                                         | ${{ date: "1999-06-15" }}
      ${"2049-12-31T23:59:59Z"}      | ${"1999–2098"}                                                                         | ${{ date: "1999-06-15" }}
      ${"2050-01-01T00:00:00Z"}      | ${"2000–2099"}                                                                         | ${{ date: "2099-06-15" }}
      ${"2050-01-01T00:00:00+02:00"} | ${"1999–2098: 22:00Z on 31 December 2049, though a clock two hours east reads 2050"}   | ${{ date: "1999-06-15" }}
      ${"2049-12-31T23:59:59-05:00"} | ${"2000–2099: 04:59:59Z on 1 January 2050, though a clock five hours west reads 2049"} | ${{ date: "2099-06-15" }}
    `(
      'reads D6 990615 with yearWindow "rolling" at $now ($window) as $expected, and as 1999 with 1950',
      ({ now, expected }) => {
        setNow(now);
        expectIso(expected);
        expect(
          parseX12DateTimePeriod("990615", "D6", { yearWindow: "rolling" }),
        ).toStrictEqual(expected);
        expect(
          parseX12DateTimePeriod("990615", "D6", { yearWindow: 1950 }),
        ).toStrictEqual({ date: "1999-06-15" });
      },
    );

    // On 2026-10-07 the rolling window is 1976–2075: 75 is its last year and 76 its first.
    it.each`
      formatQualifier | value              | expected
      ${"D6"}         | ${"750615"}        | ${{ date: "2075-06-15" }}
      ${"D6"}         | ${"760615"}        | ${{ date: "1976-06-15" }}
      ${"TT"}         | ${"061524"}        | ${{ date: "2024-06-15" }}
      ${"TR"}         | ${"1506241430"}    | ${{ local: "2024-06-15T14:30:00" }}
      ${"RD6"}        | ${"760101-751231"} | ${{ date: "1976-01-01", periodEnd: { date: "2075-12-31" } }}
      ${"TU"}         | ${"24166"}         | ${{ date: "2024-06-14", dayOfYear: 166 }}
      ${"TU"}         | ${"76366"}         | ${{ date: "1976-12-31", dayOfYear: 366 }}
    `(
      'reads $formatQualifier $value with yearWindow "rolling" on 2026-10-07 as $expected',
      ({ formatQualifier, value, expected }) => {
        setNow("2026-10-07T12:00:00Z");
        expectIso(expected);
        expect(
          parseX12DateTimePeriod(value, formatQualifier, {
            yearWindow: "rolling",
          }),
        ).toStrictEqual(expected);
      },
    );

    // The rolling window holds 2024 from UTC 1975 (1925–2024) through UTC 2074 (2024–2123): 24
    // is 1924 one second before that span and 2124 one second after it.
    it.each`
      now                       | window         | expected
      ${"1974-12-31T23:59:59Z"} | ${"1924–2023"} | ${{ date: "1924-06-15" }}
      ${"1975-01-01T00:00:00Z"} | ${"1925–2024"} | ${{ date: "2024-06-15" }}
      ${"2074-12-31T23:59:59Z"} | ${"2024–2123"} | ${{ date: "2024-06-15" }}
      ${"2075-01-01T00:00:00Z"} | ${"2025–2124"} | ${{ date: "2124-06-15" }}
    `(
      'reads D6 240615 with yearWindow "rolling" at $now ($window) as $expected',
      ({ now, expected }) => {
        setNow(now);
        expectIso(expected);
        expect(
          parseX12DateTimePeriod("240615", "D6", { yearWindow: "rolling" }),
        ).toStrictEqual(expected);
      },
    );

    it("returns null for a rolling window when the clock cannot be read", () => {
      mockTemporalNowInstantThrow();
      expect(
        parseX12DateTimePeriod("240615", "D6", { yearWindow: "rolling" }),
      ).toBeNull();
    });

    it("reads a fixed window, and a four-digit code with a rolling one, without the clock", () => {
      mockTemporalNowInstantThrow();
      expect(parseX12DateTimePeriod("240615", "D6", WINDOW_2000)).toStrictEqual(
        {
          date: "2024-06-15",
        },
      );
      expect(
        parseX12DateTimePeriod("20240615", "D8", { yearWindow: "rolling" }),
      ).toStrictEqual({ date: "2024-06-15" });
    });

    it.each`
      formatQualifier | value                              | expected
      ${"D8"}         | ${"20240615"}                      | ${{ date: "2024-06-15" }}
      ${"DB"}         | ${"06152024"}                      | ${{ date: "2024-06-15" }}
      ${"DT"}         | ${"202406151430"}                  | ${{ local: "2024-06-15T14:30:00" }}
      ${"RTS"}        | ${"20240615143045"}                | ${{ local: "2024-06-15T14:30:45" }}
      ${"TM"}         | ${"1430"}                          | ${{ time: "14:30:00" }}
      ${"TS"}         | ${"143045"}                        | ${{ time: "14:30:45" }}
      ${"RD8"}        | ${"20240615-20240620"}             | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
      ${"RD"}         | ${"06152024-06202024"}             | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
      ${"RDT"}        | ${"202406151430-202406201600"}     | ${{ local: "2024-06-15T14:30:00", periodEnd: { local: "2024-06-20T16:00:00" } }}
      ${"DTS"}        | ${"20240615143045-20240620160000"} | ${{ local: "2024-06-15T14:30:45", periodEnd: { local: "2024-06-20T16:00:00" } }}
      ${"DDT"}        | ${"20240615-202406201600"}         | ${{ date: "2024-06-15", periodEnd: { local: "2024-06-20T16:00:00" } }}
      ${"DTD"}        | ${"202406151430-20240620"}         | ${{ local: "2024-06-15T14:30:00", periodEnd: { date: "2024-06-20" } }}
      ${"RTM"}        | ${"0900-1700"}                     | ${{ time: "09:00:00", periodEnd: { time: "17:00:00" } }}
      ${"TC"}         | ${"166"}                           | ${{ dayOfYear: 166 }}
      ${"EH"}         | ${"4166"}                          | ${{ yearDigit: 4, dayOfYear: 166 }}
    `(
      "$formatQualifier has no two-digit year and ignores yearWindow: $value reads as $expected with none, 2000, 1950 and an invalid one",
      ({ formatQualifier, value, expected }) => {
        expect(parseX12DateTimePeriod(value, formatQualifier)).toStrictEqual(
          expected,
        );
        expect(
          parseX12DateTimePeriod(value, formatQualifier, {}),
        ).toStrictEqual(expected);
        expect(
          parseX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).toStrictEqual(expected);
        expect(
          parseX12DateTimePeriod(value, formatQualifier, { yearWindow: 1950 }),
        ).toStrictEqual(expected);
        expect(
          parseX12DateTimePeriod(value, formatQualifier, {
            yearWindow: 9901,
          }),
        ).toStrictEqual(expected);
      },
    );
  });

  describe("ordinal codes return `dayOfYear`", () => {
    // Day 166 is 14 June in a leap year and 15 June otherwise: 31 + 29 + 31 + 30 + 31 = 152 days
    // to the end of May 2024, and 152 + 14 = 166.
    it("day 166 of 2024 is 14 June, by plain Temporal", () => {
      expect(Temporal.PlainDate.from("2024-06-14").dayOfYear).toBe(166);
      expect(Temporal.PlainDate.from("2023-06-15").dayOfYear).toBe(166);
      expect(Temporal.PlainDate.from("2024-12-31").dayOfYear).toBe(366);
      expect(Temporal.PlainDate.from("2023-12-31").dayOfYear).toBe(365);
    });

    it.each`
      value    | expected
      ${"001"} | ${{ dayOfYear: 1 }}
      ${"365"} | ${{ dayOfYear: 365 }}
      ${"366"} | ${{ dayOfYear: 366 }}
    `(
      "reads TC (DDD) $value as $expected: a day with no year, so 366 is not checked against one",
      ({ value, expected }) => {
        expect(parseX12DateTimePeriod(value, "TC")).toStrictEqual(expected);
      },
    );

    it.each`
      value    | reads
      ${"000"} | ${"day 0"}
      ${"367"} | ${"past the longest year"}
      ${"16A"} | ${"a letter"}
    `("returns null for TC $value ($reads)", ({ value }) => {
      expect(parseX12DateTimePeriod(value, "TC")).toBeNull();
    });

    // X12 1250 `TU` is "Date Expressed in Format YYDDD": a year and a day of the year name one
    // date. Each date is counted by hand (2024 is a leap year, so 31 + 29 = day 60 is 29
    // February and day 166 is 14 June; in 2023 day 60 is 1 March) and checked the other way
    // round against plain Temporal: the date's own year and day of the year.
    it.each`
      value      | yearWindow | year    | expected
      ${"24001"} | ${2000}    | ${2024} | ${{ date: "2024-01-01", dayOfYear: 1 }}
      ${"24060"} | ${2000}    | ${2024} | ${{ date: "2024-02-29", dayOfYear: 60 }}
      ${"23060"} | ${2000}    | ${2023} | ${{ date: "2023-03-01", dayOfYear: 60 }}
      ${"24166"} | ${2000}    | ${2024} | ${{ date: "2024-06-14", dayOfYear: 166 }}
      ${"24366"} | ${2000}    | ${2024} | ${{ date: "2024-12-31", dayOfYear: 366 }}
      ${"23365"} | ${2000}    | ${2023} | ${{ date: "2023-12-31", dayOfYear: 365 }}
      ${"00366"} | ${2000}    | ${2000} | ${{ date: "2000-12-31", dayOfYear: 366 }}
      ${"96366"} | ${1950}    | ${1996} | ${{ date: "1996-12-31", dayOfYear: 366 }}
      ${"00001"} | ${0}       | ${0}    | ${{ date: "0000-01-01", dayOfYear: 1 }}
      ${"99365"} | ${9900}    | ${9999} | ${{ date: "9999-12-31", dayOfYear: 365 }}
    `(
      "reads TU (YYDDD) $value with yearWindow $yearWindow as $expected",
      ({ value, yearWindow, year, expected }) => {
        const date = Temporal.PlainDate.from(expected.date);
        expect(date.year).toBe(year);
        expect(date.dayOfYear).toBe(expected.dayOfYear);
        const result = parseX12DateTimePeriod(value, "TU", { yearWindow });
        expect(result).toStrictEqual(expected);
        expect(result).not.toHaveProperty("year");
      },
    );

    it.each`
      value      | yearWindow | reads
      ${"23366"} | ${2000}    | ${"day 366 of 2023, which has 365 days"}
      ${"00366"} | ${2001}    | ${"00 is 2100 in a 2001–2100 window, and 2100 is not a leap year"}
      ${"00366"} | ${1900}    | ${"00 is 1900 in a 1900–1999 window, and 1900 is not a leap year"}
    `(
      "returns null for TU $value with yearWindow $yearWindow ($reads)",
      ({ value, yearWindow }) => {
        expect(parseX12DateTimePeriod(value, "TU", { yearWindow })).toBeNull();
      },
    );

    it("2100 and 1900 have 365 days, by plain Temporal", () => {
      expect(Temporal.PlainDate.from("2100-12-31").dayOfYear).toBe(365);
      expect(Temporal.PlainDate.from("1900-12-31").dayOfYear).toBe(365);
      expect(Temporal.PlainDate.from("2000-12-31").dayOfYear).toBe(366);
    });

    // EH carries one digit of the year. One digit names no year, so nothing is resolved and day
    // 366 cannot be checked against one.
    it.each`
      value     | expected
      ${"0001"} | ${{ yearDigit: 0, dayOfYear: 1 }}
      ${"9365"} | ${{ yearDigit: 9, dayOfYear: 365 }}
      ${"3366"} | ${{ yearDigit: 3, dayOfYear: 366 }}
    `(
      "reads EH (YDDD) $value as $expected and resolves no year",
      ({ value, expected }) => {
        const result = parseX12DateTimePeriod(value, "EH", WINDOW_2000);
        expect(result).toStrictEqual(expected);
        expect(result).not.toHaveProperty("year");
        expect(result).not.toHaveProperty("date");
      },
    );
  });

  describe("a range whose end precedes its start is null (GMT rule)", () => {
    it.each`
      formatQualifier | value                              | reads
      ${"RD8"}        | ${"20240620-20240615"}             | ${"the end date is five days before the start"}
      ${"RD8"}        | ${"20240616-20240615"}             | ${"the end date is the day before the start"}
      ${"RD6"}        | ${"240620-240615"}                 | ${"two-digit years"}
      ${"RD"}         | ${"06202024-06152024"}             | ${"MMDDCCYY order"}
      ${"RD"}         | ${"01012025-12312024"}             | ${"MMDDCCYY order: the digits rise but the date falls"}
      ${"RDT"}        | ${"202406151431-202406151430"}     | ${"one minute"}
      ${"DTS"}        | ${"20240615143001-20240615143000"} | ${"one second"}
      ${"DDT"}        | ${"20240616-202406152359"}         | ${"the end date-time is on the day before the start date"}
      ${"DTD"}        | ${"202406160000-20240615"}         | ${"the end date is before the start date-time's date"}
    `(
      "returns null for $formatQualifier $value ($reads)",
      ({ formatQualifier, value }) => {
        expect(
          parseX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).toBeNull();
      },
    );
  });

  describe("a time-only range is returned as written (GMT rule)", () => {
    // RTM (`HHMM-HHMM`) carries no date, so an end before its start is a window that crosses
    // midnight, not a reversed range. Each expected time is the value's own digits with `:00`
    // seconds: the parser does not say which day either time falls on.
    it.each`
      value          | expected                                                 | reads
      ${"2200-0600"} | ${{ time: "22:00:00", periodEnd: { time: "06:00:00" } }} | ${"an overnight window"}
      ${"1700-0900"} | ${{ time: "17:00:00", periodEnd: { time: "09:00:00" } }} | ${"an end eight hours before its start"}
      ${"2359-0000"} | ${{ time: "23:59:00", periodEnd: { time: "00:00:00" } }} | ${"one minute across midnight"}
      ${"0001-0000"} | ${{ time: "00:01:00", periodEnd: { time: "00:00:00" } }} | ${"an end one minute before its start"}
      ${"0600-0600"} | ${{ time: "06:00:00", periodEnd: { time: "06:00:00" } }} | ${"equal times"}
    `("reads RTM $value as $expected ($reads)", ({ value, expected }) => {
      expectIso(expected);
      expect(parseX12DateTimePeriod(value, "RTM")).toStrictEqual(expected);
    });
  });

  describe("a field out of range, or a day the year does not have, is rejected (TC39 overflow: reject)", () => {
    it.each`
      formatQualifier | value                  | reads
      ${"D8"}         | ${"20230229"}          | ${"29 February 2023"}
      ${"D8"}         | ${"20240631"}          | ${"31 June"}
      ${"D8"}         | ${"20241301"}          | ${"month 13"}
      ${"D6"}         | ${"230229"}            | ${"29 February 2023 through the window"}
      ${"DB"}         | ${"15062024"}          | ${"day-first digits under a month-first code: month 15"}
      ${"TT"}         | ${"022923"}            | ${"29 February 2023 in MMDDYY"}
      ${"DT"}         | ${"202302291430"}      | ${"29 February 2023 with a time"}
      ${"TR"}         | ${"2902231430"}        | ${"29 February 2023 in DDMMYYHHMM"}
      ${"RTS"}        | ${"20240615143060"}    | ${"second 60: a leap second is not read"}
      ${"RD8"}        | ${"20240615-20240631"} | ${"31 June in the end"}
    `(
      "returns null for $formatQualifier $value ($reads)",
      ({ formatQualifier, value }) => {
        expect(
          parseX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).toBeNull();
      },
    );
  });

  describe("a value that does not fit its code's mask is rejected", () => {
    it.each`
      formatQualifier | value                  | reads
      ${"D8"}         | ${"2024-06-15"}        | ${"an ISO 8601 date in an X12 element"}
      ${"D8"}         | ${"2024061A"}          | ${"a letter"}
      ${"D8"}         | ${"２０２４０６１５"}  | ${"full-width digits"}
      ${"D8"}         | ${"20240615\n"}        | ${"a trailing newline"}
      ${"DT"}         | ${"202406151430Z"}     | ${"a UTC designator: no 1250 code carries one"}
      ${"DT"}         | ${"202406151430+0200"} | ${"an offset: no 1250 code carries one"}
      ${"DT"}         | ${"202406151430ET"}    | ${"a 623 time code joined to the value: it is its own element"}
      ${"TS"}         | ${"14304500"}          | ${"hundredths of a second: TS is HHMMSS"}
    `(
      "returns null for $formatQualifier $value ($reads)",
      ({ formatQualifier, value }) => {
        expect(
          parseX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).toBeNull();
      },
    );
  });

  describe("UN (Unstructured) is never read", () => {
    it.each`
      value
      ${"20240615"}
      ${"202406151430"}
      ${"15 June 2024"}
      ${"UN"}
      ${""}
    `(
      "returns null for UN '$value': GMT never guesses a format",
      ({ value }) => {
        expect(parseX12DateTimePeriod(value, "UN")).toBeNull();
        expect(parseX12DateTimePeriod(value, "UN", WINDOW_2000)).toBeNull();
      },
    );
  });

  describe("a code GMT does not read returns null", () => {
    // Each value is one the code's own mask would accept, so null comes from the code alone.
    it.each`
      formatQualifier | value              | definition
      ${"CC"}         | ${"20"}            | ${"First Two Digits of Year Expressed in Format CCYY"}
      ${"CY"}         | ${"2024"}          | ${"Year Expressed in Format CCYY"}
      ${"CM"}         | ${"202406"}        | ${"Date in Format CCYYMM"}
      ${"YM"}         | ${"2406"}          | ${"Year and Month Expressed in Format YYMM"}
      ${"MD"}         | ${"0615"}          | ${"Month of Year and Day of Month Expressed in Format MMDD"}
      ${"DD"}         | ${"15"}            | ${"Day of Month in Numeric Format"}
      ${"MM"}         | ${"06"}            | ${"Month of Year in Numeric Format"}
      ${"TQ"}         | ${"0624"}          | ${"Date Expressed in Format MMYY"}
      ${"YY"}         | ${"24"}            | ${"Last Two Digits of Year Expressed in Format CCYY"}
      ${"CD"}         | ${"JUN2024"}       | ${"Month and Year Expressed in Format MMMYYYY"}
      ${"KA"}         | ${"24JUN15"}       | ${"Date Expressed in Format YYMMMDD"}
      ${"YMM"}        | ${"2024JUN-JUL"}   | ${"Range of Year and Months, Expressed in CCYYMMM-MMM Format"}
      ${"CQ"}         | ${"20242"}         | ${"Date in Format CCYYQ"}
      ${"MCY"}        | ${"062024"}        | ${"MMCCYY"}
      ${"DA"}         | ${"15-20"}         | ${"Range of Dates within a Single Month Expressed in Format DD-DD"}
      ${"RD2"}        | ${"24-25"}         | ${"Range of Years Expressed in Format YY-YY"}
      ${"RD4"}        | ${"2024-2025"}     | ${"Range of Years Expressed in Format CCYY-CCYY"}
      ${"RD5"}        | ${"202406-202407"} | ${"Range of Years and Months Expressed in Format CCYYMM-CCYYMM"}
      ${"RDM"}        | ${"240615-0620"}   | ${"Range of Dates Expressed in Format YYMMDD-MMDD: the end names no year"}
      ${"RMD"}        | ${"0615-0620"}     | ${"Range of Months and Days Expressed in Format MMDD-MMDD"}
      ${"RMY"}        | ${"2406-2407"}     | ${"Range of Years and Months Expressed in Format YYMM-YYMM"}
    `(
      "returns null for $formatQualifier $value ($definition)",
      ({ formatQualifier, value }) => {
        expect(
          parseX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).toBeNull();
      },
    );

    it.each`
      formatQualifier | reads
      ${"ZZ"}         | ${"an unknown code"}
      ${""}           | ${"an empty string"}
      ${"d8"}         | ${"lower case: matching is exact"}
      ${" D8"}        | ${"a leading space"}
      ${"D8 "}        | ${"a trailing space"}
      ${"DTM"}        | ${"a segment name, not a 1250 code"}
      ${"102"}        | ${"the UN/EDIFACT 2379 code for the same mask"}
      ${"toString"}   | ${"an inherited property name"}
      ${"__proto__"}  | ${"an inherited property name"}
    `(
      "returns null for 20240615 under the format qualifier '$formatQualifier' ($reads)",
      ({ formatQualifier }) => {
        expect(parseX12DateTimePeriod("20240615", formatQualifier)).toBeNull();
      },
    );
  });

  describe("the options argument is omitted, undefined or an Object", () => {
    // D8 has a four-digit year and never reads the bag, so null comes from the argument alone.
    it.each`
      make                 | kind
      ${() => null}        | ${"null"}
      ${() => "2000"}      | ${"a string"}
      ${() => "rolling"}   | ${"the string a caller might pass for the window"}
      ${() => 2000}        | ${"a number, the window passed positionally"}
      ${() => true}        | ${"a boolean"}
      ${() => 0n}          | ${"a bigint"}
      ${() => Symbol("x")} | ${"a symbol"}
    `(
      "returns null for D8 20240615 with options that are $kind",
      ({ make }) => {
        expect(
          parseX12DateTimePeriod("20240615", "D8", make() as never),
        ).toBeNull();
      },
    );

    it.each`
      make                                                 | kind
      ${() => undefined}                                   | ${"undefined"}
      ${() => ({})}                                        | ${"an empty object"}
      ${() => []}                                          | ${"an array: an Object"}
      ${() => Object.assign(() => undefined, WINDOW_2000)} | ${"a function carrying the option"}
      ${() => Object.create(null)}                         | ${"an object with no prototype"}
    `("reads D8 20240615 with options that are $kind", ({ make }) => {
      expect(
        parseX12DateTimePeriod("20240615", "D8", make() as never),
      ).toStrictEqual({ date: "2024-06-15" });
    });

    it("reads a function carrying yearWindow as the object", () => {
      expect(
        parseX12DateTimePeriod(
          "240615",
          "D6",
          Object.assign(() => undefined, WINDOW_2000),
        ),
      ).toStrictEqual({ date: "2024-06-15" });
    });

    // A hostile bag is an Object. D6 reads yearWindow from it, which throws, so the result is
    // null; D8 never reads it.
    it.each`
      make                                                                | kind
      ${() => hostileProxy()}                                             | ${"a Proxy that throws on any trap"}
      ${() => revokedProxy()}                                             | ${"a revoked Proxy"}
      ${() => Object.defineProperty({}, "yearWindow", { get: throwing })} | ${"an object whose yearWindow getter throws"}
    `(
      "returns null for D6 240615 with options that are $kind, and reads D8 without touching them",
      ({ make }) => {
        expect(
          parseX12DateTimePeriod("240615", "D6", make() as never),
        ).toBeNull();
        expect(
          parseX12DateTimePeriod("20240615", "D8", make() as never),
        ).toStrictEqual({ date: "2024-06-15" });
      },
    );
  });

  // A non-string collapses to one path per argument. 20240615 is the number a caller might pass
  // for a D8 value.
  it.each`
    argument             | call
    ${"value"}           | ${(bad: unknown) => parseX12DateTimePeriod(bad as never, "D8")}
    ${"formatQualifier"} | ${(bad: unknown) => parseX12DateTimePeriod("20240615", bad as never)}
  `("returns null for a $argument that is not a string", ({ call }) => {
    for (const [kind, make] of NON_STRINGS) {
      expect(call(make()), kind).toBeNull();
    }
  });

  describe("never throws when Temporal does", () => {
    it("returns null for D8 when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(parseX12DateTimePeriod("20240615", "D8")).toBeNull();
    });

    it("returns null for DT when Temporal.PlainDateTime.from throws", () => {
      mockTemporalPlainDateTimeFromThrow();
      expect(parseX12DateTimePeriod("202406151430", "DT")).toBeNull();
    });

    it("returns null for TM when Temporal.PlainTime.from throws", () => {
      mockTemporalPlainTimeFromThrow();
      expect(parseX12DateTimePeriod("1430", "TM")).toBeNull();
    });
  });
});
