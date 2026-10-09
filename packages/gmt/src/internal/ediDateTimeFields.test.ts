import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import {
  mockTemporalInstantFromThrow,
  mockTemporalPlainDateFromThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../test/mocks";
import {
  readEdiRange,
  readEdiValue,
  readX12DateAndTime,
  readX12Time,
} from "./ediDateTimeFields";

/**
 * Every expected value is read off the standard's mask by hand: the fixture is 15 June 2024 at
 * 14:30 (and 45 seconds where the mask has `SS`). The digit-level grammar of each mask is
 * asserted in `ediGrammar.test.ts`; this file holds what the reader adds: one ISO 8601 value per
 * kind, the calendar check, the offset forms and the order of a period's ends.
 */
describe("readEdiValue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The house value of each kind: a date `YYYY-MM-DD`, a time `HH:MM:SS`, a local date-time
  // `YYYY-MM-DDTHH:MM:SS`, and a date-time with its offset `YYYY-MM-DDTHH:MM:SS±HH:MM`. Seconds
  // are always written, `00` for a mask without them.
  it.each`
    standard     | kind                | code     | value                    | expected
    ${"edifact"} | ${"date"}           | ${"102"} | ${"20240615"}            | ${"2024-06-15"}
    ${"edifact"} | ${"time"}           | ${"401"} | ${"1430"}                | ${"14:30:00"}
    ${"edifact"} | ${"time"}           | ${"402"} | ${"143045"}              | ${"14:30:45"}
    ${"edifact"} | ${"dateTime"}       | ${"203"} | ${"202406151430"}        | ${"2024-06-15T14:30:00"}
    ${"edifact"} | ${"dateTime"}       | ${"204"} | ${"20240615143045"}      | ${"2024-06-15T14:30:45"}
    ${"edifact"} | ${"offsetDateTime"} | ${"205"} | ${"202406151430+0200"}   | ${"2024-06-15T14:30:00+02:00"}
    ${"edifact"} | ${"offsetDateTime"} | ${"208"} | ${"20240615143045+0530"} | ${"2024-06-15T14:30:45+05:30"}
    ${"edifact"} | ${"offsetDateTime"} | ${"303"} | ${"202406151430+02"}     | ${"2024-06-15T14:30:00+02:00"}
    ${"edifact"} | ${"offsetDateTime"} | ${"304"} | ${"20240615143045-05"}   | ${"2024-06-15T14:30:45-05:00"}
    ${"x12"}     | ${"date"}           | ${"D8"}  | ${"20240615"}            | ${"2024-06-15"}
    ${"x12"}     | ${"date"}           | ${"DB"}  | ${"06152024"}            | ${"2024-06-15"}
    ${"x12"}     | ${"dateTime"}       | ${"DT"}  | ${"202406151430"}        | ${"2024-06-15T14:30:00"}
    ${"x12"}     | ${"dateTime"}       | ${"RTS"} | ${"20240615143045"}      | ${"2024-06-15T14:30:45"}
    ${"x12"}     | ${"time"}           | ${"TM"}  | ${"1430"}                | ${"14:30:00"}
    ${"x12"}     | ${"time"}           | ${"TS"}  | ${"143045"}              | ${"14:30:45"}
  `(
    "reads $standard $code $value as the $kind $expected",
    ({ standard, kind, code, value, expected }) => {
      expect(readEdiValue(standard, kind, code, value)).toBe(expected);
    },
  );

  // A function reads one kind. A code of another kind is refused whatever the value, and so is a
  // period or range code: `readEdiRange` reads those.
  it.each`
    standard     | kind                | code     | value                  | reads
    ${"edifact"} | ${"date"}           | ${"203"} | ${"202406151430"}      | ${"a date-time code under a date reader"}
    ${"edifact"} | ${"dateTime"}       | ${"102"} | ${"20240615"}          | ${"a date code under a date-time reader"}
    ${"edifact"} | ${"dateTime"}       | ${"205"} | ${"202406151430+0200"} | ${"an offset code under a local date-time reader"}
    ${"edifact"} | ${"offsetDateTime"} | ${"203"} | ${"202406151430"}      | ${"a local code under an offset reader"}
    ${"edifact"} | ${"time"}           | ${"203"} | ${"202406151430"}      | ${"a date-time code under a time reader"}
    ${"edifact"} | ${"date"}           | ${"718"} | ${"2024061520240620"}  | ${"a period code under a date reader"}
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024061520240620"}  | ${"a period code read as a single value"}
    ${"x12"}     | ${"date"}           | ${"DT"}  | ${"202406151430"}      | ${"a date-time code under a date reader"}
    ${"x12"}     | ${"dateRange"}      | ${"RD8"} | ${"20240615-20240620"} | ${"a range code read as a single value"}
    ${"x12"}     | ${"date"}           | ${"102"} | ${"20240615"}          | ${"a UN/EDIFACT code under X12"}
    ${"edifact"} | ${"date"}           | ${"D8"}  | ${"20240615"}          | ${"an X12 code under UN/EDIFACT"}
    ${"edifact"} | ${"date"}           | ${"101"} | ${"240615"}            | ${"a two-digit-year code: not read"}
    ${"x12"}     | ${"date"}           | ${"D6"}  | ${"240615"}            | ${"a two-digit-year code: not read"}
    ${"x12"}     | ${"date"}           | ${"UN"}  | ${"20240615"}          | ${"Unstructured: not read"}
  `(
    "returns '' for $standard $code under $kind ($reads)",
    ({ standard, kind, code, value }) => {
      expect(readEdiValue(standard, kind, code, value)).toBe("");
    },
  );

  // The grammar proves the shape; Temporal, with overflow "reject", proves the date is real.
  it.each`
    standard     | kind                | code     | value                | reads
    ${"edifact"} | ${"date"}           | ${"102"} | ${"20230229"}        | ${"29 February 2023, not a leap year"}
    ${"edifact"} | ${"date"}           | ${"102"} | ${"20240631"}        | ${"31 June"}
    ${"edifact"} | ${"dateTime"}       | ${"203"} | ${"202302291430"}    | ${"29 February 2023 with a time"}
    ${"edifact"} | ${"dateTime"}       | ${"203"} | ${"202406152430"}    | ${"hour 24"}
    ${"edifact"} | ${"dateTime"}       | ${"204"} | ${"20240615143060"}  | ${"second 60: GMT rejects a leap second"}
    ${"edifact"} | ${"offsetDateTime"} | ${"303"} | ${"202302291430+02"} | ${"29 February 2023 with an offset"}
    ${"edifact"} | ${"time"}           | ${"401"} | ${"2400"}            | ${"hour 24"}
    ${"x12"}     | ${"date"}           | ${"DB"}  | ${"02292023"}        | ${"29 February 2023, month first"}
    ${"x12"}     | ${"dateTime"}       | ${"RTS"} | ${"20240631143045"}  | ${"31 June"}
    ${"x12"}     | ${"date"}           | ${"D8"}  | ${"2024-06-15"}      | ${"an ISO 8601 date is not the mask"}
    ${"x12"}     | ${"date"}           | ${"D8"}  | ${""}                | ${"an empty value"}
  `(
    "returns '' for $standard $code $value ($reads)",
    ({ standard, kind, code, value }) => {
      expect(readEdiValue(standard, kind, code, value)).toBe("");
    },
  );

  // 29 February exists in 2024 and in year 0000 (divisible by 400), and the four digits of
  // `CCYY` run from 0000 to 9999.
  it.each`
    code     | value         | expected
    ${"102"} | ${"20240229"} | ${"2024-02-29"}
    ${"102"} | ${"00000101"} | ${"0000-01-01"}
    ${"102"} | ${"00000229"} | ${"0000-02-29"}
    ${"102"} | ${"99991231"} | ${"9999-12-31"}
  `("reads $code $value as $expected", ({ code, value, expected }) => {
    expect(Temporal.PlainDate.from(expected).toString()).toBe(expected);
    expect(readEdiValue("edifact", "date", code, value)).toBe(expected);
  });

  describe("a date-time with an offset", () => {
    // The value is the wall clock as written with its offset: the string `fromOffsetInstant`
    // writes. `instant` is that wall clock less the offset, worked out by hand and checked
    // against plain `Temporal.Instant.from`: the value names that instant.
    it.each`
      code     | value                    | expected                       | instant                      | reads
      ${"205"} | ${"202406151430-0500"}   | ${"2024-06-15T14:30:00-05:00"} | ${"2024-06-15T19:30:00Z"}    | ${"a whole hour west"}
      ${"205"} | ${"202406151430+0000"}   | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"UTC"}
      ${"205"} | ${"202406151430-0000"}   | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"-0000 is the offset +00:00"}
      ${"205"} | ${"202406151430+0545"}   | ${"2024-06-15T14:30:00+05:45"} | ${"2024-06-15T08:45:00Z"}    | ${"a 45-minute offset"}
      ${"205"} | ${"202406151430+2359"}   | ${"2024-06-15T14:30:00+23:59"} | ${"2024-06-14T14:31:00Z"}    | ${"the largest offset the mask holds"}
      ${"205"} | ${"202406150030+0200"}   | ${"2024-06-15T00:30:00+02:00"} | ${"2024-06-14T22:30:00Z"}    | ${"the wall clock stays on its own day: the instant is the day before"}
      ${"205"} | ${"000001010030+0200"}   | ${"0000-01-01T00:30:00+02:00"} | ${"-000001-12-31T22:30:00Z"} | ${"the first four-digit year: the instant is before it"}
      ${"205"} | ${"999912312330-0200"}   | ${"9999-12-31T23:30:00-02:00"} | ${"+010000-01-01T01:30:00Z"} | ${"the last four-digit year: the instant is after it"}
      ${"208"} | ${"20240615143045+0200"} | ${"2024-06-15T14:30:45+02:00"} | ${"2024-06-15T12:30:45Z"}    | ${"seconds"}
      ${"303"} | ${"202406151430-05"}     | ${"2024-06-15T14:30:00-05:00"} | ${"2024-06-15T19:30:00Z"}    | ${"-05, the Recommendation 7 example"}
      ${"303"} | ${"202406151430-00"}     | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"-00 is the offset +00:00"}
      ${"303"} | ${"202406151430UTC"}     | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"the literal UTC"}
      ${"303"} | ${"202406151430GMT"}     | ${"2024-06-15T14:30:00+00:00"} | ${"2024-06-15T14:30:00Z"}    | ${"the literal GMT: UTC's former name (Rec 7 ¶12)"}
      ${"303"} | ${"202406151430+23"}     | ${"2024-06-15T14:30:00+23:00"} | ${"2024-06-14T15:30:00Z"}    | ${"+23, the largest hour"}
      ${"304"} | ${"20241231233045-12"}   | ${"2024-12-31T23:30:45-12:00"} | ${"2025-01-01T11:30:45Z"}    | ${"seconds: the instant is in the year after"}
    `(
      "reads $code $value as $expected, the instant $instant ($reads)",
      ({ code, value, expected, instant }) => {
        expect(Temporal.Instant.from(expected).toString()).toBe(instant);
        expect(readEdiValue("edifact", "offsetDateTime", code, value)).toBe(
          expected,
        );
      },
    );

    // The three zone characters are read as an offset only. No UN/EDIFACT text defines an
    // abbreviation, so letters other than `UTC` and `GMT` are not read.
    it.each`
      text     | reads
      ${"CET"} | ${"an abbreviation"}
      ${"PDT"} | ${"an abbreviation"}
      ${"UTZ"} | ${"one letter off UTC"}
      ${"ZZZ"} | ${"Z is not read as a UTC designator"}
      ${"+24"} | ${"a signed 24: one past the last hour"}
      ${"000"} | ${"digits alone, no sign"}
      ${"utc"} | ${"lower case"}
      ${"Z"}   | ${"a lone Z: the mask has three zone characters"}
      ${" 02"} | ${"a space for the sign"}
    `(
      "returns '' for the zone characters '$text' under 303 ($reads)",
      ({ text }) => {
        expect(
          readEdiValue(
            "edifact",
            "offsetDateTime",
            "303",
            `202406151430${text}`,
          ),
        ).toBe("");
      },
    );
  });

  it.each`
    description               | value
    ${"null"}                 | ${null}
    ${"undefined"}            | ${undefined}
    ${"a number"}             | ${20240615}
    ${"an array of a string"} | ${["20240615"]}
    ${"an object"}            | ${{}}
  `("returns '' for a value that is $description", ({ value }) => {
    expect(readEdiValue("edifact", "date", "102", value as never)).toBe("");
    expect(readEdiValue("edifact", "date", value as never, "20240615")).toBe(
      "",
    );
  });

  describe("the catch path", () => {
    it("returns '' when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(readEdiValue("edifact", "date", "102", "20240615")).toBe("");
    });

    it("returns '' when Temporal.PlainDateTime.from throws", () => {
      mockTemporalPlainDateTimeFromThrow();
      expect(readEdiValue("edifact", "dateTime", "203", "202406151430")).toBe(
        "",
      );
    });

    it("returns '' when Temporal.PlainTime.from throws", () => {
      mockTemporalPlainTimeFromThrow();
      expect(readEdiValue("edifact", "time", "401", "1430")).toBe("");
    });

    it("returns '' when Temporal.Instant.from throws under an offset code", () => {
      mockTemporalInstantFromThrow();
      expect(
        readEdiValue("edifact", "offsetDateTime", "205", "202406151430+0200"),
      ).toBe("");
    });
  });
});

describe("readEdiRange", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // A UN/EDIFACT period is run together; an X12 range has its one hyphen.
  it.each`
    standard     | kind                | code     | value                              | expected
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024061520240620"}              | ${{ start: "2024-06-15", end: "2024-06-20" }}
    ${"edifact"} | ${"dateTimePeriod"} | ${"719"} | ${"202406151430202406201600"}      | ${{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }}
    ${"x12"}     | ${"dateRange"}      | ${"RD8"} | ${"20240615-20240620"}             | ${{ start: "2024-06-15", end: "2024-06-20" }}
    ${"x12"}     | ${"dateRange"}      | ${"RD"}  | ${"06152024-06202024"}             | ${{ start: "2024-06-15", end: "2024-06-20" }}
    ${"x12"}     | ${"dateTimeRange"}  | ${"RDT"} | ${"202406151430-202406201600"}     | ${{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }}
    ${"x12"}     | ${"dateTimeRange"}  | ${"DTS"} | ${"20240615143045-20240620160030"} | ${{ start: "2024-06-15T14:30:45", end: "2024-06-20T16:00:30" }}
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024061520240615"}              | ${{ start: "2024-06-15", end: "2024-06-15" }}
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"0000010199991231"}              | ${{ start: "0000-01-01", end: "9999-12-31" }}
    ${"x12"}     | ${"dateTimeRange"}  | ${"RDT"} | ${"202406151430-202406151430"}     | ${{ start: "2024-06-15T14:30:00", end: "2024-06-15T14:30:00" }}
  `(
    "reads $standard $code $value as $expected",
    ({ standard, kind, code, value, expected }) => {
      expect(readEdiRange(standard, kind, code, value)).toEqual(expected);
    },
  );

  // GMT rule: a period whose end precedes its start names no span of time.
  it.each`
    standard     | kind                | code     | value                              | reads
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024062020240615"}              | ${"the end date is five days before the start"}
    ${"edifact"} | ${"dateTimePeriod"} | ${"719"} | ${"202406151431202406151430"}      | ${"the end is one minute before the start"}
    ${"x12"}     | ${"dateRange"}      | ${"RD8"} | ${"20240620-20240615"}             | ${"the end date is five days before the start"}
    ${"x12"}     | ${"dateRange"}      | ${"RD"}  | ${"01012025-12312024"}             | ${"month first: the end is a day before the start, although its digits sort after"}
    ${"x12"}     | ${"dateTimeRange"}  | ${"DTS"} | ${"20240615143001-20240615143000"} | ${"the end is one second before the start"}
  `(
    "returns null for the reversed $standard $code $value ($reads)",
    ({ standard, kind, code, value }) => {
      expect(readEdiRange(standard, kind, code, value)).toBeNull();
    },
  );

  it.each`
    standard     | kind               | code     | value                          | reads
    ${"edifact"} | ${"datePeriod"}    | ${"718"} | ${"20240615-20240620"}         | ${"a hyphen: X12's wire form, never a 2379 one"}
    ${"edifact"} | ${"datePeriod"}    | ${"718"} | ${"2023022920240620"}          | ${"29 February 2023 in the start"}
    ${"edifact"} | ${"datePeriod"}    | ${"718"} | ${"2024061520230229"}          | ${"29 February 2023 in the end"}
    ${"edifact"} | ${"datePeriod"}    | ${"719"} | ${"202406151430202406201600"}  | ${"a date-time period code under a date period reader"}
    ${"edifact"} | ${"datePeriod"}    | ${"102"} | ${"20240615"}                  | ${"a single date code"}
    ${"edifact"} | ${"date"}          | ${"102"} | ${"20240615"}                  | ${"a single date read as a period"}
    ${"x12"}     | ${"dateRange"}     | ${"RD8"} | ${"2024061520240620"}          | ${"no hyphen: UN/EDIFACT's wire form, never an X12 one"}
    ${"x12"}     | ${"dateRange"}     | ${"RD8"} | ${"20240615--20240620"}        | ${"two hyphens"}
    ${"x12"}     | ${"dateRange"}     | ${"RDT"} | ${"202406151430-202406201600"} | ${"a date-time range code under a date range reader"}
    ${"x12"}     | ${"dateRange"}     | ${"RD6"} | ${"240615-240620"}             | ${"a two-digit-year code: not read"}
    ${"x12"}     | ${"dateTimeRange"} | ${"DDT"} | ${"20240615-202406201600"}     | ${"a date and a date-time: not read"}
  `(
    "returns null for $standard $code $value under $kind ($reads)",
    ({ standard, kind, code, value }) => {
      expect(readEdiRange(standard, kind, code, value)).toBeNull();
    },
  );

  it("returns null for a value that is not a string", () => {
    expect(
      readEdiRange("edifact", "datePeriod", "718", null as never),
    ).toBeNull();
    expect(
      readEdiRange("edifact", "datePeriod", "718", 20240615 as never),
    ).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      readEdiRange("edifact", "datePeriod", "718", "2024061520240620"),
    ).toBeNull();
  });
});

describe("readX12Time", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // X12 data element 337: "HHMM, or HHMMSS, or HHMMSSD, or HHMMSSDD … D = tenths (0-9) and
  // DD = hundredths (00-99)". One digit of decimal seconds is tenths (0.1 s); two are hundredths
  // (0.12 s). A zero fraction is not written.
  it.each`
    value         | expected         | reads
    ${"1430"}     | ${"14:30:00"}    | ${"HHMM"}
    ${"143045"}   | ${"14:30:45"}    | ${"HHMMSS"}
    ${"1430451"}  | ${"14:30:45.1"}  | ${"HHMMSSD: one tenth"}
    ${"14304512"} | ${"14:30:45.12"} | ${"HHMMSSDD: twelve hundredths"}
    ${"14304505"} | ${"14:30:45.05"} | ${"five hundredths"}
    ${"14304550"} | ${"14:30:45.5"}  | ${"fifty hundredths is five tenths"}
    ${"1430450"}  | ${"14:30:45"}    | ${"zero tenths: no fraction"}
    ${"14304500"} | ${"14:30:45"}    | ${"zero hundredths: no fraction"}
    ${"0000"}     | ${"00:00:00"}    | ${"midnight"}
    ${"23595999"} | ${"23:59:59.99"} | ${"the last hundredth of the day"}
  `("reads $value as $expected ($reads)", ({ value, expected }) => {
    expect(Temporal.PlainTime.from(expected).toString()).toBe(expected);
    expect(readX12Time(value)).toBe(expected);
  });

  it.each`
    value          | reads
    ${"2400"}      | ${"hour 24"}
    ${"1460"}      | ${"minute 60"}
    ${"143060"}    | ${"second 60: GMT rejects a leap second"}
    ${"14304"}     | ${"five digits"}
    ${"143045123"} | ${"nine digits: thousandths are not an element 337 form"}
    ${"14:30"}     | ${"a colon"}
    ${"930"}       | ${"an unpadded hour"}
    ${" 1430"}     | ${"a leading space"}
    ${""}          | ${"an empty value"}
  `("returns '' for $value ($reads)", ({ value }) => {
    expect(readX12Time(value)).toBe("");
  });

  it("returns '' for a value that is not a string", () => {
    expect(readX12Time(1430 as never)).toBe("");
    expect(readX12Time(null as never)).toBe("");
  });

  it("returns '' when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(readX12Time("1430")).toBe("");
  });
});

describe("readX12DateAndTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Element 373 is `CCYYMMDD` and element 337 is one of its four forms; together they are one
  // local date-time, with the fraction the time carried.
  it.each`
    date          | time          | expected
    ${"20240615"} | ${"1430"}     | ${"2024-06-15T14:30:00"}
    ${"20240615"} | ${"143045"}   | ${"2024-06-15T14:30:45"}
    ${"20240615"} | ${"1430001"}  | ${"2024-06-15T14:30:00.1"}
    ${"20240615"} | ${"14300012"} | ${"2024-06-15T14:30:00.12"}
    ${"20240229"} | ${"0000"}     | ${"2024-02-29T00:00:00"}
    ${"00000101"} | ${"0000"}     | ${"0000-01-01T00:00:00"}
    ${"99991231"} | ${"23595999"} | ${"9999-12-31T23:59:59.99"}
  `("reads $date and $time as $expected", ({ date, time, expected }) => {
    expect(Temporal.PlainDateTime.from(expected).toString()).toBe(expected);
    expect(readX12DateAndTime(date, time)).toBe(expected);
  });

  it.each`
    date          | time       | reads
    ${""}         | ${"1430"}  | ${"no date"}
    ${"20240615"} | ${""}      | ${"no time"}
    ${""}         | ${""}      | ${"neither"}
    ${"20230229"} | ${"1430"}  | ${"29 February 2023"}
    ${"20240615"} | ${"2430"}  | ${"hour 24"}
    ${"240615"}   | ${"1430"}  | ${"a two-digit year: element 373 is CCYYMMDD"}
    ${"06152024"} | ${"1430"}  | ${"month first: element 373 is CCYYMMDD"}
    ${"20240615"} | ${"14:30"} | ${"a colon in the time"}
  `("returns '' for $date and $time ($reads)", ({ date, time }) => {
    expect(readX12DateAndTime(date, time)).toBe("");
  });

  it("returns '' when either argument is not a string", () => {
    expect(readX12DateAndTime(undefined as never, "1430")).toBe("");
    expect(readX12DateAndTime("20240615", undefined as never)).toBe("");
    expect(readX12DateAndTime(20240615 as never, 1430 as never)).toBe("");
  });

  it("returns '' when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(readX12DateAndTime("20240615", "1430")).toBe("");
  });
});
