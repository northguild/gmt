import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import {
  mockTemporalInstantFromThrow,
  mockTemporalNowInstantThrow,
  mockTemporalPlainDateFromThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../test/mocks";
import { readEdiDateTime } from "./ediDateTimeFields";
import {
  EDIFACT_TWO_DIGIT_YEAR_FORMATS,
  X12_TWO_DIGIT_YEAR_FORMATS,
} from "./ediGrammar";

/** The instant a wall clock names at an offset, from plain Temporal: the cross-check for every instant below. */
function instantAt(local: string, offset: string): string {
  return Temporal.Instant.from(`${local}${offset}`).toString();
}

const WINDOW_2000 = { yearWindow: 2000 };

describe("readEdiDateTime: UNTDID 2379 happy paths", () => {
  // Each expected value is read off the mask by hand (2024-06-15 14:30 is the fixture throughout)
  // and the instants are cross-checked against Temporal.Instant.from in `instantAt`.
  it.each`
    code     | value                         | expected
    ${"101"} | ${"240615"}                   | ${{ date: "2024-06-15" }}
    ${"102"} | ${"20240615"}                 | ${{ date: "2024-06-15" }}
    ${"201"} | ${"2406151430"}               | ${{ local: "2024-06-15T14:30:00" }}
    ${"202"} | ${"240615143045"}             | ${{ local: "2024-06-15T14:30:45" }}
    ${"203"} | ${"202406151430"}             | ${{ local: "2024-06-15T14:30:00" }}
    ${"204"} | ${"20240615143045"}           | ${{ local: "2024-06-15T14:30:45" }}
    ${"205"} | ${"202406151430+0200"}        | ${{ local: "2024-06-15T14:30:00", offset: "+02:00", instant: instantAt("2024-06-15T14:30:00", "+02:00") }}
    ${"205"} | ${"202406151430+0530"}        | ${{ local: "2024-06-15T14:30:00", offset: "+05:30", instant: instantAt("2024-06-15T14:30:00", "+05:30") }}
    ${"205"} | ${"202406151430-0000"}        | ${{ local: "2024-06-15T14:30:00", offset: "+00:00", instant: instantAt("2024-06-15T14:30:00", "+00:00") }}
    ${"206"} | ${"2406151430+0200"}          | ${{ local: "2024-06-15T14:30:00", offset: "+02:00", instant: instantAt("2024-06-15T14:30:00", "+02:00") }}
    ${"207"} | ${"240615143045-0530"}        | ${{ local: "2024-06-15T14:30:45", offset: "-05:30", instant: instantAt("2024-06-15T14:30:45", "-05:30") }}
    ${"208"} | ${"20240615143045+0200"}      | ${{ local: "2024-06-15T14:30:45", offset: "+02:00", instant: instantAt("2024-06-15T14:30:45", "+02:00") }}
    ${"209"} | ${"143045+0200"}              | ${{ time: "14:30:45", offset: "+02:00" }}
    ${"209"} | ${"143045-0000"}              | ${{ time: "14:30:45", offset: "+00:00" }}
    ${"301"} | ${"2406151430+02"}            | ${{ local: "2024-06-15T14:30:00", offset: "+02:00", instant: instantAt("2024-06-15T14:30:00", "+02:00") }}
    ${"302"} | ${"240615143045UTC"}          | ${{ local: "2024-06-15T14:30:45", offset: "+00:00", instant: instantAt("2024-06-15T14:30:45", "+00:00") }}
    ${"303"} | ${"202406151430+02"}          | ${{ local: "2024-06-15T14:30:00", offset: "+02:00", instant: instantAt("2024-06-15T14:30:00", "+02:00") }}
    ${"303"} | ${"202406151430-05"}          | ${{ local: "2024-06-15T14:30:00", offset: "-05:00", instant: instantAt("2024-06-15T14:30:00", "-05:00") }}
    ${"303"} | ${"202406151430+00"}          | ${{ local: "2024-06-15T14:30:00", offset: "+00:00", instant: instantAt("2024-06-15T14:30:00", "+00:00") }}
    ${"303"} | ${"202406151430UTC"}          | ${{ local: "2024-06-15T14:30:00", offset: "+00:00", instant: instantAt("2024-06-15T14:30:00", "+00:00") }}
    ${"303"} | ${"202406151430PDT"}          | ${{ local: "2024-06-15T14:30:00", zone: "PDT" }}
    ${"303"} | ${"202406151430CET"}          | ${{ local: "2024-06-15T14:30:00", zone: "CET" }}
    ${"303"} | ${"202406151430GMT"}          | ${{ local: "2024-06-15T14:30:00", offset: "+00:00", instant: "2024-06-15T14:30:00Z" }}
    ${"404"} | ${"143045GMT"}                | ${{ time: "14:30:45", offset: "+00:00" }}
    ${"304"} | ${"20240615143045+02"}        | ${{ local: "2024-06-15T14:30:45", offset: "+02:00", instant: instantAt("2024-06-15T14:30:45", "+02:00") }}
    ${"401"} | ${"1430"}                     | ${{ time: "14:30:00" }}
    ${"402"} | ${"143045"}                   | ${{ time: "14:30:45" }}
    ${"404"} | ${"143045+02"}                | ${{ time: "14:30:45", offset: "+02:00" }}
    ${"404"} | ${"143045UTC"}                | ${{ time: "14:30:45", offset: "+00:00" }}
    ${"404"} | ${"143045PDT"}                | ${{ time: "14:30:45", zone: "PDT" }}
    ${"406"} | ${"+0200"}                    | ${{ offset: "+02:00" }}
    ${"406"} | ${"-0530"}                    | ${{ offset: "-05:30" }}
    ${"406"} | ${"-0000"}                    | ${{ offset: "+00:00" }}
    ${"713"} | ${"24061514302406201600"}     | ${{ local: "2024-06-15T14:30:00", periodEnd: { local: "2024-06-20T16:00:00" } }}
    ${"717"} | ${"240615240620"}             | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
    ${"718"} | ${"2024061520240620"}         | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
    ${"718"} | ${"2024061520240615"}         | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-15" } }}
    ${"719"} | ${"202406151430202406201600"} | ${{ local: "2024-06-15T14:30:00", periodEnd: { local: "2024-06-20T16:00:00" } }}
  `(
    "reads $value under code $code as $expected",
    ({ code, value, expected }) => {
      expect(readEdiDateTime("edifact", code, value, WINDOW_2000)).toEqual(
        expected,
      );
    },
  );
});

describe("readEdiDateTime: X12 1250 happy paths", () => {
  it.each`
    code     | value                              | expected
    ${"D6"}  | ${"240615"}                        | ${{ date: "2024-06-15" }}
    ${"D8"}  | ${"20240615"}                      | ${{ date: "2024-06-15" }}
    ${"DB"}  | ${"06152024"}                      | ${{ date: "2024-06-15" }}
    ${"TT"}  | ${"061524"}                        | ${{ date: "2024-06-15" }}
    ${"DT"}  | ${"202406151430"}                  | ${{ local: "2024-06-15T14:30:00" }}
    ${"TR"}  | ${"1506241430"}                    | ${{ local: "2024-06-15T14:30:00" }}
    ${"RTS"} | ${"20240615143045"}                | ${{ local: "2024-06-15T14:30:45" }}
    ${"TM"}  | ${"1430"}                          | ${{ time: "14:30:00" }}
    ${"TS"}  | ${"143045"}                        | ${{ time: "14:30:45" }}
    ${"RD6"} | ${"240615-240620"}                 | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
    ${"RD8"} | ${"20240615-20240620"}             | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
    ${"RD"}  | ${"06152024-06202024"}             | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
    ${"RDT"} | ${"202406151430-202406201600"}     | ${{ local: "2024-06-15T14:30:00", periodEnd: { local: "2024-06-20T16:00:00" } }}
    ${"DTS"} | ${"20240615143045-20240620160000"} | ${{ local: "2024-06-15T14:30:45", periodEnd: { local: "2024-06-20T16:00:00" } }}
    ${"DDT"} | ${"20240615-202406201600"}         | ${{ date: "2024-06-15", periodEnd: { local: "2024-06-20T16:00:00" } }}
    ${"DDT"} | ${"20240615-202406150000"}         | ${{ date: "2024-06-15", periodEnd: { local: "2024-06-15T00:00:00" } }}
    ${"DTD"} | ${"202406151430-20240620"}         | ${{ local: "2024-06-15T14:30:00", periodEnd: { date: "2024-06-20" } }}
    ${"DTD"} | ${"202406151430-20240615"}         | ${{ local: "2024-06-15T14:30:00", periodEnd: { date: "2024-06-15" } }}
    ${"RTM"} | ${"0900-1700"}                     | ${{ time: "09:00:00", periodEnd: { time: "17:00:00" } }}
    ${"TC"}  | ${"166"}                           | ${{ dayOfYear: 166 }}
    ${"TC"}  | ${"001"}                           | ${{ dayOfYear: 1 }}
    ${"TC"}  | ${"366"}                           | ${{ dayOfYear: 366 }}
    ${"TU"}  | ${"24166"}                         | ${{ date: "2024-06-14", dayOfYear: 166 }}
    ${"TU"}  | ${"24366"}                         | ${{ date: "2024-12-31", dayOfYear: 366 }}
    ${"TU"}  | ${"23365"}                         | ${{ date: "2023-12-31", dayOfYear: 365 }}
    ${"EH"}  | ${"4166"}                          | ${{ yearDigit: 4, dayOfYear: 166 }}
    ${"EH"}  | ${"3366"}                          | ${{ yearDigit: 3, dayOfYear: 366 }}
  `(
    "reads $value under code $code as $expected",
    ({ code, value, expected }) => {
      expect(readEdiDateTime("x12", code, value, WINDOW_2000)).toEqual(
        expected,
      );
    },
  );
});

describe("readEdiDateTime: two-digit years resolve in the caller's yearWindow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each`
    standard     | code     | value             | yearWindow | expected
    ${"edifact"} | ${"101"} | ${"690101"}       | ${1969}    | ${{ date: "1969-01-01" }}
    ${"edifact"} | ${"101"} | ${"680101"}       | ${1969}    | ${{ date: "2068-01-01" }}
    ${"edifact"} | ${"101"} | ${"990101"}       | ${1950}    | ${{ date: "1999-01-01" }}
    ${"edifact"} | ${"101"} | ${"490101"}       | ${1950}    | ${{ date: "2049-01-01" }}
    ${"edifact"} | ${"101"} | ${"000101"}       | ${2000}    | ${{ date: "2000-01-01" }}
    ${"edifact"} | ${"717"} | ${"991231000101"} | ${1950}    | ${{ date: "1999-12-31", periodEnd: { date: "2000-01-01" } }}
    ${"x12"}     | ${"TT"}  | ${"010169"}       | ${1969}    | ${{ date: "1969-01-01" }}
    ${"x12"}     | ${"TR"}  | ${"0101690000"}   | ${1969}    | ${{ local: "1969-01-01T00:00:00" }}
    ${"x12"}     | ${"TU"}  | ${"96366"}        | ${1950}    | ${{ date: "1996-12-31", dayOfYear: 366 }}
  `(
    "$standard $code $value with yearWindow $yearWindow reads as $expected",
    ({ standard, code, value, yearWindow, expected }) => {
      expect(readEdiDateTime(standard, code, value, { yearWindow })).toEqual(
        expected,
      );
    },
  );

  // GMT rule: rolling is 50 years before the current UTC calendar year to 49 after it.
  it.each`
    now                       | expected
    ${"2026-10-07T12:00:00Z"} | ${{ date: "1999-06-15" }}
    ${"2049-12-31T23:59:59Z"} | ${{ date: "1999-06-15" }}
    ${"2050-01-01T00:00:00Z"} | ${{ date: "2099-06-15" }}
  `(
    '101 "990615" with yearWindow "rolling" at $now reads as $expected',
    ({ now, expected }) => {
      vi.spyOn(Temporal.Now, "instant").mockReturnValue(
        Temporal.Instant.from(now),
      );
      expect(
        readEdiDateTime("edifact", "101", "990615", { yearWindow: "rolling" }),
      ).toEqual(expected);
      expect(
        readEdiDateTime("edifact", "101", "990615", { yearWindow: 1950 }),
      ).toEqual({ date: "1999-06-15" });
    },
  );

  it("returns null for a rolling window when the clock cannot be read", () => {
    mockTemporalNowInstantThrow();
    expect(
      readEdiDateTime("edifact", "101", "240615", { yearWindow: "rolling" }),
    ).toBeNull();
  });

  const TWO_DIGIT_VALUES: Record<string, string> = {
    "101": "240615",
    "201": "2406151430",
    "202": "240615143000",
    "206": "2406151430+0200",
    "207": "240615143000+0200",
    "301": "2406151430+02",
    "302": "240615143000+02",
    "713": "24061514302406201600",
    "717": "240615240620",
    D6: "240615",
    TT: "061524",
    TR: "1506241430",
    RD6: "240615-240620",
    TU: "24166",
  };

  const BAD_WINDOWS: [string, unknown][] = [
    ["omitted", undefined],
    ["an empty bag", {}],
    ["null", { yearWindow: null }],
    ["a non-integer", { yearWindow: 1.5 }],
    ["negative", { yearWindow: -1 }],
    ["9901", { yearWindow: 9901 }],
    ["NaN", { yearWindow: Number.NaN }],
    ["Infinity", { yearWindow: Number.POSITIVE_INFINITY }],
    ["a numeric string", { yearWindow: "2000" }],
    ["Rolling", { yearWindow: "Rolling" }],
  ];

  it.each(
    EDIFACT_TWO_DIGIT_YEAR_FORMATS.map((code) => ({
      standard: "edifact" as const,
      code,
    })),
  )(
    "$standard $code returns null for every missing or invalid window, and a value with 2000",
    ({ standard, code }) => {
      const value = TWO_DIGIT_VALUES[code];
      expect(
        readEdiDateTime(standard, code, value, WINDOW_2000),
      ).not.toBeNull();
      for (const [, options] of BAD_WINDOWS) {
        expect(readEdiDateTime(standard, code, value, options)).toBeNull();
      }
    },
  );

  it.each(
    X12_TWO_DIGIT_YEAR_FORMATS.map((code) => ({
      standard: "x12" as const,
      code,
    })),
  )(
    "$standard $code returns null for every missing or invalid window, and a value with 2000",
    ({ standard, code }) => {
      const value = TWO_DIGIT_VALUES[code];
      expect(
        readEdiDateTime(standard, code, value, WINDOW_2000),
      ).not.toBeNull();
      for (const [, options] of BAD_WINDOWS) {
        expect(readEdiDateTime(standard, code, value, options)).toBeNull();
      }
    },
  );

  it.each`
    standard     | code     | value
    ${"edifact"} | ${"102"} | ${"20240615"}
    ${"edifact"} | ${"203"} | ${"202406151430"}
    ${"edifact"} | ${"205"} | ${"202406151430+0200"}
    ${"edifact"} | ${"401"} | ${"1430"}
    ${"edifact"} | ${"406"} | ${"+0200"}
    ${"edifact"} | ${"718"} | ${"2024061520240620"}
    ${"x12"}     | ${"D8"}  | ${"20240615"}
    ${"x12"}     | ${"DB"}  | ${"06152024"}
    ${"x12"}     | ${"RD8"} | ${"20240615-20240620"}
    ${"x12"}     | ${"TC"}  | ${"166"}
    ${"x12"}     | ${"EH"}  | ${"4166"}
  `(
    "$standard $code ignores the window: the same result with none, 2000, 1950 and an invalid one",
    ({ standard, code, value }) => {
      const reference = readEdiDateTime(standard, code, value, WINDOW_2000);
      expect(reference).not.toBeNull();
      for (const options of [
        undefined,
        {},
        { yearWindow: 1950 },
        { yearWindow: 9901 },
      ]) {
        expect(readEdiDateTime(standard, code, value, options)).toEqual(
          reference,
        );
      }
    },
  );
});

describe("readEdiDateTime: calendar validity is Temporal's", () => {
  // 2023 and 2100 have no 29 February and 365 days; 2024 and 2000 have both (plain Temporal).
  it.each`
    standard     | code     | value                  | yearWindow | reason
    ${"edifact"} | ${"102"} | ${"20230229"}          | ${2000}    | ${"29 February 2023"}
    ${"edifact"} | ${"102"} | ${"20240230"}          | ${2000}    | ${"30 February"}
    ${"edifact"} | ${"102"} | ${"20240631"}          | ${2000}    | ${"31 June"}
    ${"edifact"} | ${"101"} | ${"230229"}            | ${2000}    | ${"29 February 2023 through the window"}
    ${"edifact"} | ${"101"} | ${"000229"}            | ${2001}    | ${"00 is 2100 in a 2001–2100 window: no 29 February"}
    ${"edifact"} | ${"203"} | ${"202302291430"}      | ${2000}    | ${"29 February 2023 with a time"}
    ${"edifact"} | ${"303"} | ${"202302291430+02"}   | ${2000}    | ${"29 February 2023 with an offset"}
    ${"edifact"} | ${"718"} | ${"2024061520240631"}  | ${2000}    | ${"31 June in the end"}
    ${"edifact"} | ${"718"} | ${"2023022920240620"}  | ${2000}    | ${"29 February 2023 in the start"}
    ${"x12"}     | ${"D8"}  | ${"20240431"}          | ${2000}    | ${"31 April"}
    ${"x12"}     | ${"DB"}  | ${"02292023"}          | ${2000}    | ${"29 February 2023 in MMDDCCYY"}
    ${"x12"}     | ${"RD8"} | ${"20230229-20240620"} | ${2000}    | ${"29 February 2023 in the start of a range"}
    ${"x12"}     | ${"TU"}  | ${"23366"}             | ${2000}    | ${"day 366 of 2023, which has 365 days"}
    ${"x12"}     | ${"TU"}  | ${"00366"}             | ${2001}    | ${"00 is 2100 in a 2001–2100 window, which has 365 days"}
  `(
    "$standard $code $value with yearWindow $yearWindow is null ($reason)",
    ({ standard, code, value, yearWindow }) => {
      expect(Temporal.PlainDate.from("2023-12-31").dayOfYear).toBe(365);
      expect(Temporal.PlainDate.from("2100-12-31").dayOfYear).toBe(365);
      expect(readEdiDateTime(standard, code, value, { yearWindow })).toBeNull();
    },
  );

  it("TU 00366 in a window where 00 is 2000 is day 366 of a leap year", () => {
    expect(Temporal.PlainDate.from("2000-12-31").dayOfYear).toBe(366);
    expect(readEdiDateTime("x12", "TU", "00366", WINDOW_2000)).toEqual({
      date: "2000-12-31",
      dayOfYear: 366,
    });
  });
});

describe("readEdiDateTime: a period whose end precedes its start is null (GMT rule)", () => {
  it.each`
    standard     | code     | value                              | reason
    ${"edifact"} | ${"718"} | ${"2024062020240615"}              | ${"end date before start date"}
    ${"edifact"} | ${"717"} | ${"240620240615"}                  | ${"two-digit years"}
    ${"edifact"} | ${"719"} | ${"202406151431202406151430"}      | ${"end one minute before start"}
    ${"edifact"} | ${"713"} | ${"24061514312406151430"}          | ${"two-digit years, one minute"}
    ${"x12"}     | ${"RD8"} | ${"20240620-20240615"}             | ${"end date before start date"}
    ${"x12"}     | ${"RD"}  | ${"06202024-06152024"}             | ${"MMDDCCYY order"}
    ${"x12"}     | ${"RDT"} | ${"202406151431-202406151430"}     | ${"one minute"}
    ${"x12"}     | ${"DTS"} | ${"20240615143001-20240615143000"} | ${"one second"}
    ${"x12"}     | ${"DDT"} | ${"20240616-202406152359"}         | ${"end date-time on the day before the start date"}
    ${"x12"}     | ${"DTD"} | ${"202406160000-20240615"}         | ${"end date before the start date-time's date"}
  `("$standard $code $value is null ($reason)", ({ standard, code, value }) => {
    expect(readEdiDateTime(standard, code, value, WINDOW_2000)).toBeNull();
  });

  it("an equal start and end is a zero-length period, not a reversed one", () => {
    expect(readEdiDateTime("x12", "RD8", "20240615-20240615")).toEqual({
      date: "2024-06-15",
      periodEnd: { date: "2024-06-15" },
    });
  });
});

describe("readEdiDateTime: a time-only range is returned as written (GMT rule)", () => {
  // RTM (`HHMM-HHMM`) carries no date, so an end before its start is a window that crosses
  // midnight, not a reversed range: the reader has no date to compare and returns both times.
  // Each expected time is the value's own digits with `:00` seconds.
  it.each`
    value          | expected                                                 | reads
    ${"2200-0600"} | ${{ time: "22:00:00", periodEnd: { time: "06:00:00" } }} | ${"an overnight window"}
    ${"1700-0900"} | ${{ time: "17:00:00", periodEnd: { time: "09:00:00" } }} | ${"an end eight hours before its start"}
    ${"2359-0000"} | ${{ time: "23:59:00", periodEnd: { time: "00:00:00" } }} | ${"one minute across midnight"}
    ${"0001-0000"} | ${{ time: "00:01:00", periodEnd: { time: "00:00:00" } }} | ${"an end one minute before its start"}
    ${"0600-0600"} | ${{ time: "06:00:00", periodEnd: { time: "06:00:00" } }} | ${"equal times"}
    ${"0900-1700"} | ${{ time: "09:00:00", periodEnd: { time: "17:00:00" } }} | ${"a window inside one day"}
  `("x12 RTM $value reads as $expected ($reads)", ({ value, expected }) => {
    expect(readEdiDateTime("x12", "RTM", value)).toEqual(expected);
  });
});

describe("readEdiDateTime: shape mismatches and unsupported codes", () => {
  it.each`
    standard     | code     | value                    | reason
    ${"edifact"} | ${"303"} | ${"202406151430?+02"}    | ${"release character: the element value is taken unescaped"}
    ${"edifact"} | ${"303"} | ${"202406151430+0200"}   | ${"205's ZHHMM under a ZZZ code"}
    ${"edifact"} | ${"303"} | ${"202406151430+24"}     | ${"ZZZ +24: a broken offset, not a zone name"}
    ${"edifact"} | ${"404"} | ${"143045000"}           | ${"ZZZ of digits alone"}
    ${"edifact"} | ${"304"} | ${"20240615143000+0200"} | ${"the spec's own corrected 304 example"}
    ${"edifact"} | ${"203"} | ${"20240615143000"}      | ${"204's value under 203"}
    ${"edifact"} | ${"204"} | ${"202406151430"}        | ${"203's value under 204"}
    ${"edifact"} | ${"203"} | ${" 202406151430"}       | ${"leading whitespace"}
    ${"edifact"} | ${"203"} | ${""}                    | ${"empty value"}
    ${"edifact"} | ${"718"} | ${"20240615-20240620"}   | ${"a hyphen: never transmitted in a 2379 period"}
    ${"x12"}     | ${"RD8"} | ${"2024061520240620"}    | ${"no hyphen: X12 transmits it"}
    ${"x12"}     | ${"TC"}  | ${"000"}                 | ${"day 000"}
    ${"x12"}     | ${"TC"}  | ${"367"}                 | ${"day 367"}
    ${"x12"}     | ${"UN"}  | ${"x"}                   | ${"unstructured: never guessed"}
    ${"x12"}     | ${"UN"}  | ${"20240615"}            | ${"unstructured, even when it looks like D8"}
  `("$standard $code $value is null ($reason)", ({ standard, code, value }) => {
    expect(readEdiDateTime(standard, code, value, WINDOW_2000)).toBeNull();
  });

  it.each`
    standard     | code
    ${"edifact"} | ${"2"}
    ${"edifact"} | ${"3"}
    ${"edifact"} | ${"602"}
    ${"edifact"} | ${"609"}
    ${"edifact"} | ${"610"}
    ${"edifact"} | ${"616"}
    ${"edifact"} | ${"720"}
    ${"edifact"} | ${"801"}
    ${"edifact"} | ${"804"}
    ${"edifact"} | ${"D8"}
    ${"edifact"} | ${""}
    ${"x12"}     | ${"CC"}
    ${"x12"}     | ${"CY"}
    ${"x12"}     | ${"CM"}
    ${"x12"}     | ${"YM"}
    ${"x12"}     | ${"MD"}
    ${"x12"}     | ${"DD"}
    ${"x12"}     | ${"MM"}
    ${"x12"}     | ${"TQ"}
    ${"x12"}     | ${"YY"}
    ${"x12"}     | ${"CD"}
    ${"x12"}     | ${"KA"}
    ${"x12"}     | ${"YMM"}
    ${"x12"}     | ${"RMY"}
    ${"x12"}     | ${"203"}
    ${"x12"}     | ${"d8"}
    ${"x12"}     | ${""}
  `(
    "$standard code $code is unsupported: null for a value that fits some other code",
    ({ standard, code }) => {
      expect(
        readEdiDateTime(standard, code, "20240615", WINDOW_2000),
      ).toBeNull();
    },
  );

  it.each`
    input        | description
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${20240615}  | ${"number"}
    ${true}      | ${"boolean"}
    ${[]}        | ${"array"}
    ${{}}        | ${"object"}
  `("returns null when the value is $description", ({ input }) => {
    expect(
      readEdiDateTime("edifact", "102", input as never, WINDOW_2000),
    ).toBeNull();
    expect(
      readEdiDateTime("x12", "D8", input as never, WINDOW_2000),
    ).toBeNull();
    expect(
      readEdiDateTime("edifact", input as never, "20240615", WINDOW_2000),
    ).toBeNull();
    expect(
      readEdiDateTime(input as never, "102", "20240615", WINDOW_2000),
    ).toBeNull();
  });
});

describe("readEdiDateTime: the catch path", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      readEdiDateTime("edifact", "102", "20240615", WINDOW_2000),
    ).toBeNull();
  });

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(
      readEdiDateTime("edifact", "203", "202406151430", WINDOW_2000),
    ).toBeNull();
  });

  it("returns null when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(readEdiDateTime("edifact", "401", "1430", WINDOW_2000)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws under an offset code", () => {
    mockTemporalInstantFromThrow();
    expect(
      readEdiDateTime("edifact", "205", "202406151430+0200", WINDOW_2000),
    ).toBeNull();
    expect(readEdiDateTime("edifact", "406", "+0200", WINDOW_2000)).toBeNull();
  });
});
