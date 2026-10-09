import { vi } from "vitest";
import {
  mockTemporalInstantFromThrow,
  mockTemporalPlainDateFromThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../test/mocks";
import {
  writeEdiRange,
  writeEdiValue,
  writeX12TimeElement,
} from "./ediDateTimeWriter";

/**
 * Every expected value is the ISO 8601 input placed under the standard's mask by hand: each
 * field zero-padded to the width the mask gives, in mask order. A field the mask does not have
 * (seconds under a minute mask, a fraction under any mask) is left out, never rounded.
 */
describe("writeEdiValue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each`
    standard     | kind                | code     | value                          | expected
    ${"edifact"} | ${"date"}           | ${"102"} | ${"2024-06-15"}                | ${"20240615"}
    ${"edifact"} | ${"time"}           | ${"401"} | ${"14:30"}                     | ${"1430"}
    ${"edifact"} | ${"time"}           | ${"402"} | ${"14:30:45"}                  | ${"143045"}
    ${"edifact"} | ${"dateTime"}       | ${"203"} | ${"2024-06-15T14:30"}          | ${"202406151430"}
    ${"edifact"} | ${"dateTime"}       | ${"204"} | ${"2024-06-15T14:30:45"}       | ${"20240615143045"}
    ${"edifact"} | ${"offsetDateTime"} | ${"205"} | ${"2024-06-15T14:30:00+02:00"} | ${"202406151430+0200"}
    ${"edifact"} | ${"offsetDateTime"} | ${"208"} | ${"2024-06-15T14:30:45+05:30"} | ${"20240615143045+0530"}
    ${"edifact"} | ${"offsetDateTime"} | ${"303"} | ${"2024-06-15T14:30:00+02:00"} | ${"202406151430+02"}
    ${"edifact"} | ${"offsetDateTime"} | ${"304"} | ${"2024-06-15T14:30:45-05:00"} | ${"20240615143045-05"}
    ${"x12"}     | ${"date"}           | ${"D8"}  | ${"2024-06-15"}                | ${"20240615"}
    ${"x12"}     | ${"date"}           | ${"DB"}  | ${"2024-06-15"}                | ${"06152024"}
    ${"x12"}     | ${"dateTime"}       | ${"DT"}  | ${"2024-06-15T14:30"}          | ${"202406151430"}
    ${"x12"}     | ${"dateTime"}       | ${"RTS"} | ${"2024-06-15T14:30:45"}       | ${"20240615143045"}
    ${"x12"}     | ${"time"}           | ${"TM"}  | ${"14:30"}                     | ${"1430"}
    ${"x12"}     | ${"time"}           | ${"TS"}  | ${"14:30:45"}                  | ${"143045"}
  `(
    "writes the $kind $value under $standard $code as $expected",
    ({ standard, kind, code, value, expected }) => {
      expect(writeEdiValue(standard, kind, code, value)).toBe(expected);
    },
  );

  describe("precision is cut to the mask, never rounded and never refused", () => {
    // A fraction of a second is always dropped. Seconds are dropped under a mask with no `SS`.
    // 59.9 seconds stays in minute 30 and 45.9 seconds stays second 45: the cut is a truncation.
    it.each`
      standard     | kind                | code     | value                              | expected
      ${"edifact"} | ${"time"}           | ${"401"} | ${"14:30:45"}                      | ${"1430"}
      ${"edifact"} | ${"time"}           | ${"401"} | ${"14:30:59.999999999"}            | ${"1430"}
      ${"edifact"} | ${"time"}           | ${"402"} | ${"14:30:45.9"}                    | ${"143045"}
      ${"edifact"} | ${"time"}           | ${"402"} | ${"14:30"}                         | ${"143000"}
      ${"edifact"} | ${"dateTime"}       | ${"203"} | ${"2024-06-15T14:30:45"}           | ${"202406151430"}
      ${"edifact"} | ${"dateTime"}       | ${"203"} | ${"2024-06-15T23:59:59.9"}         | ${"202406152359"}
      ${"edifact"} | ${"dateTime"}       | ${"204"} | ${"2024-06-15T14:30:45.9"}         | ${"20240615143045"}
      ${"edifact"} | ${"dateTime"}       | ${"204"} | ${"2024-06-15T14:30"}              | ${"20240615143000"}
      ${"edifact"} | ${"offsetDateTime"} | ${"205"} | ${"2024-06-15T14:30:45.9+02:00"}   | ${"202406151430+0200"}
      ${"edifact"} | ${"offsetDateTime"} | ${"208"} | ${"2024-06-15T14:30:45.9+02:00"}   | ${"20240615143045+0200"}
      ${"edifact"} | ${"offsetDateTime"} | ${"303"} | ${"2024-06-15T14:30:45+02:00"}     | ${"202406151430+02"}
      ${"edifact"} | ${"offsetDateTime"} | ${"304"} | ${"2024-06-15T14:30:45.123+02:00"} | ${"20240615143045+02"}
      ${"x12"}     | ${"time"}           | ${"TM"}  | ${"14:30:45.123"}                  | ${"1430"}
      ${"x12"}     | ${"time"}           | ${"TS"}  | ${"14:30:45.123"}                  | ${"143045"}
      ${"x12"}     | ${"dateTime"}       | ${"DT"}  | ${"2024-06-15T14:30:45"}           | ${"202406151430"}
      ${"x12"}     | ${"dateTime"}       | ${"RTS"} | ${"2024-06-15T14:30:45.9"}         | ${"20240615143045"}
    `(
      "writes $value under $standard $code as $expected",
      ({ standard, kind, code, value, expected }) => {
        expect(writeEdiValue(standard, kind, code, value)).toBe(expected);
      },
    );
  });

  describe("a date-time with an offset", () => {
    // The digits are the value's own wall clock, never the UTC clock. `ZHHMM` is the offset's
    // sign, hours and minutes; `ZZZ` is always the signed hour of UN/ECE Recommendation 7 ¶12,
    // never `UTC` or `GMT`. `Z` and `-00:00` are the offset +00:00.
    it.each`
      code     | value                                         | expected                 | reads
      ${"205"} | ${"2024-06-15T14:30:00Z"}                     | ${"202406151430+0000"}   | ${"a Z instant"}
      ${"303"} | ${"2024-06-15T14:30:00Z"}                     | ${"202406151430+00"}     | ${"a Z instant, never UTC"}
      ${"205"} | ${"2024-06-15T14:30:00-00:00"}                | ${"202406151430+0000"}   | ${"-00:00 is +00:00"}
      ${"303"} | ${"2024-01-01T00:30:00+02:00"}                | ${"202401010030+02"}     | ${"the wall clock, although the instant is the day before"}
      ${"205"} | ${"2024-06-15T14:30:00-03:30"}                | ${"202406151430-0330"}   | ${"a half hour west"}
      ${"205"} | ${"2024-06-15T14:30:00+05:45"}                | ${"202406151430+0545"}   | ${"a 45-minute offset"}
      ${"205"} | ${"2024-06-15T14:30:00-12:00"}                | ${"202406151430-1200"}   | ${"the most negative offset in use"}
      ${"303"} | ${"2024-06-15T14:30:00+14:00"}                | ${"202406151430+14"}     | ${"the largest offset in use"}
      ${"208"} | ${"0000-01-01T00:30:00+02:00"}                | ${"00000101003000+0200"} | ${"the first four-digit year: the instant is before it"}
      ${"205"} | ${"9999-12-31T23:30:00-02:00"}                | ${"999912312330-0200"}   | ${"the last four-digit year: the instant is after it"}
      ${"303"} | ${"2024-06-15T14:30:00+02:00[Europe/Berlin]"} | ${"202406151430+02"}     | ${"a bracketed zone that agrees with the offset"}
      ${"303"} | ${"2024-06-14T19:00:00Z[Europe/London]"}      | ${"202406142000+01"}     | ${"a bracketed zone sets the wall clock: 19:00Z is 20:00 at +01:00"}
    `(
      "writes $value under $code as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(writeEdiValue("edifact", "offsetDateTime", code, value)).toBe(
          expected,
        );
      },
    );

    // `ZZZ` holds whole hours and `ZHHMM` whole minutes. An offset the field cannot hold is
    // never rounded: the value would name another instant.
    it.each`
      code     | value                                         | reads
      ${"303"} | ${"2024-06-15T14:30:00+05:30"}                | ${"offset minutes under ZZZ: use 205"}
      ${"304"} | ${"2024-06-15T14:30:45+05:45"}                | ${"offset minutes under ZZZ: use 208"}
      ${"303"} | ${"2024-06-15T14:30:00-03:30"}                | ${"a half hour west under ZZZ"}
      ${"205"} | ${"2024-06-15T14:30:00+05:45:30"}             | ${"offset seconds under ZHHMM"}
      ${"208"} | ${"2024-06-15T14:30:00-00:44:30"}             | ${"offset seconds under ZHHMM"}
      ${"303"} | ${"2024-06-15T14:30:00+02:00:30"}             | ${"offset seconds under ZZZ"}
      ${"205"} | ${"2024-06-15T14:30:00+01:00[Europe/Berlin]"} | ${"an offset its bracketed zone contradicts"}
      ${"205"} | ${"2024-06-15T14:30:00"}                      | ${"a local date-time: no offset to write"}
      ${"303"} | ${"2024-06-15"}                               | ${"a date"}
      ${"303"} | ${"14:30:00+02:00"}                           | ${"a time with an offset: no date"}
      ${"205"} | ${"+010000-01-01T01:30:00Z"}                  | ${"a wall clock in year 10000"}
      ${"205"} | ${"-000001-12-31T23:00:00+00:00"}             | ${"a wall clock before year 0000"}
      ${"205"} | ${"20240615T143000+0200"}                     | ${"basic format: the input is extended ISO 8601"}
    `("returns '' for $value under $code ($reads)", ({ code, value }) => {
      expect(writeEdiValue("edifact", "offsetDateTime", code, value)).toBe("");
    });
  });

  // A function writes one kind, as the house plain functions read one kind: a date function
  // takes what `isValidDate` accepts, and so on. Nothing is coerced from another kind.
  it.each`
    standard     | kind          | code     | value                          | reads
    ${"edifact"} | ${"date"}     | ${"102"} | ${"2024-06-15T14:30:00"}       | ${"a date-time under a date code"}
    ${"edifact"} | ${"date"}     | ${"102"} | ${"2024-06-15T14:30:00Z"}      | ${"an instant under a date code"}
    ${"edifact"} | ${"date"}     | ${"102"} | ${"14:30"}                     | ${"a time under a date code"}
    ${"edifact"} | ${"date"}     | ${"102"} | ${"20240615"}                  | ${"basic format: the input is extended ISO 8601"}
    ${"edifact"} | ${"date"}     | ${"102"} | ${"2023-02-29"}                | ${"29 February 2023"}
    ${"edifact"} | ${"date"}     | ${"102"} | ${"2024-06-15[u-ca=hebrew]"}   | ${"a calendar other than ISO 8601"}
    ${"edifact"} | ${"dateTime"} | ${"203"} | ${"2024-06-15"}                | ${"a date under a date-time code"}
    ${"edifact"} | ${"dateTime"} | ${"203"} | ${"2024-06-15T14:30:00+02:00"} | ${"an offset under a local date-time code"}
    ${"edifact"} | ${"dateTime"} | ${"203"} | ${"2024-06-15T14:30:00Z"}      | ${"an instant under a local date-time code"}
    ${"edifact"} | ${"dateTime"} | ${"204"} | ${"2024-06-15T23:59:60"}       | ${"a leap second"}
    ${"edifact"} | ${"time"}     | ${"401"} | ${"2024-06-15T14:30:00"}       | ${"a date-time under a time code"}
    ${"edifact"} | ${"time"}     | ${"401"} | ${"24:00"}                     | ${"hour 24"}
    ${"edifact"} | ${"time"}     | ${"402"} | ${"14:30:00+02:00"}            | ${"a time with an offset"}
    ${"x12"}     | ${"date"}     | ${"D8"}  | ${"2024-06-15T14:30"}          | ${"a date-time under a date code"}
    ${"x12"}     | ${"dateTime"} | ${"DT"}  | ${"2024-06-15T14:30Z"}         | ${"an instant: no 1250 code carries an offset"}
    ${"x12"}     | ${"time"}     | ${"TM"}  | ${"2024-06-15"}                | ${"a date under a time code"}
    ${"x12"}     | ${"date"}     | ${"D8"}  | ${""}                          | ${"an empty value"}
  `(
    "returns '' for $value under $standard $code ($reads)",
    ({ standard, kind, code, value }) => {
      expect(writeEdiValue(standard, kind, code, value)).toBe("");
    },
  );

  // `CCYY` is four digits and no sign.
  it.each`
    standard     | kind          | code     | value                    | expected
    ${"edifact"} | ${"date"}     | ${"102"} | ${"0000-01-01"}          | ${"00000101"}
    ${"edifact"} | ${"date"}     | ${"102"} | ${"9999-12-31"}          | ${"99991231"}
    ${"edifact"} | ${"date"}     | ${"102"} | ${"+010000-01-01"}       | ${""}
    ${"edifact"} | ${"date"}     | ${"102"} | ${"-000001-12-31"}       | ${""}
    ${"x12"}     | ${"date"}     | ${"DB"}  | ${"0000-01-01"}          | ${"01010000"}
    ${"x12"}     | ${"date"}     | ${"DB"}  | ${"+010000-01-01"}       | ${""}
    ${"x12"}     | ${"dateTime"} | ${"DT"}  | ${"9999-12-31T23:59"}    | ${"999912312359"}
    ${"x12"}     | ${"dateTime"} | ${"DT"}  | ${"+010000-01-01T00:00"} | ${""}
  `(
    "writes $value under $standard $code as '$expected' (a year outside 0000–9999 is not written)",
    ({ standard, kind, code, value, expected }) => {
      expect(writeEdiValue(standard, kind, code, value)).toBe(expected);
    },
  );

  it.each`
    standard     | kind            | code     | value           | reads
    ${"edifact"} | ${"date"}       | ${"203"} | ${"2024-06-15"} | ${"a date-time code under a date writer"}
    ${"edifact"} | ${"date"}       | ${"718"} | ${"2024-06-15"} | ${"a period code under a date writer"}
    ${"edifact"} | ${"datePeriod"} | ${"718"} | ${"2024-06-15"} | ${"a period code written as a single value"}
    ${"edifact"} | ${"date"}       | ${"101"} | ${"2024-06-15"} | ${"a two-digit-year code: not written"}
    ${"edifact"} | ${"date"}       | ${"D8"}  | ${"2024-06-15"} | ${"an X12 code under UN/EDIFACT"}
    ${"x12"}     | ${"date"}       | ${"D6"}  | ${"2024-06-15"} | ${"a two-digit-year code: not written"}
    ${"x12"}     | ${"date"}       | ${"TC"}  | ${"2024-06-15"} | ${"a day of the year: not written"}
    ${"x12"}     | ${"date"}       | ${"UN"}  | ${"2024-06-15"} | ${"Unstructured"}
    ${"x12"}     | ${"dateRange"}  | ${"RD8"} | ${"2024-06-15"} | ${"a range code written as a single value"}
  `(
    "returns '' for $standard $code under $kind ($reads)",
    ({ standard, kind, code, value }) => {
      expect(writeEdiValue(standard, kind, code, value)).toBe("");
    },
  );

  it.each`
    description               | value
    ${"null"}                 | ${null}
    ${"undefined"}            | ${undefined}
    ${"a number"}             | ${20240615}
    ${"an array of a string"} | ${["2024-06-15"]}
    ${"an object"}            | ${{}}
  `("returns '' for a value or a code that is $description", ({ value }) => {
    expect(writeEdiValue("edifact", "date", "102", value as never)).toBe("");
    expect(writeEdiValue("edifact", "date", value as never, "2024-06-15")).toBe(
      "",
    );
  });

  describe("the catch path", () => {
    it("returns '' when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(writeEdiValue("edifact", "date", "102", "2024-06-15")).toBe("");
    });

    it("returns '' when Temporal.PlainDateTime.from throws", () => {
      mockTemporalPlainDateTimeFromThrow();
      expect(
        writeEdiValue("edifact", "dateTime", "203", "2024-06-15T14:30"),
      ).toBe("");
    });

    it("returns '' when Temporal.PlainTime.from throws", () => {
      mockTemporalPlainTimeFromThrow();
      expect(writeEdiValue("edifact", "time", "401", "14:30")).toBe("");
    });

    it("returns '' when Temporal.Instant.from throws under an offset code", () => {
      mockTemporalInstantFromThrow();
      expect(
        writeEdiValue(
          "edifact",
          "offsetDateTime",
          "205",
          "2024-06-15T14:30:00+02:00",
        ),
      ).toBe("");
    });
  });
});

describe("writeEdiRange", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The halves are joined by what the standard transmits: nothing for UNTDID 2379, one hyphen
  // for X12 1250.
  it.each`
    standard     | kind                | code     | start                    | end                        | expected
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024-06-15"}          | ${"2024-06-20"}            | ${"2024061520240620"}
    ${"edifact"} | ${"dateTimePeriod"} | ${"719"} | ${"2024-06-15T14:30"}    | ${"2024-06-20T16:00"}      | ${"202406151430202406201600"}
    ${"x12"}     | ${"dateRange"}      | ${"RD8"} | ${"2024-06-15"}          | ${"2024-06-20"}            | ${"20240615-20240620"}
    ${"x12"}     | ${"dateRange"}      | ${"RD"}  | ${"2024-06-15"}          | ${"2024-06-20"}            | ${"06152024-06202024"}
    ${"x12"}     | ${"dateTimeRange"}  | ${"RDT"} | ${"2024-06-15T14:30"}    | ${"2024-06-20T16:00"}      | ${"202406151430-202406201600"}
    ${"x12"}     | ${"dateTimeRange"}  | ${"DTS"} | ${"2024-06-15T14:30:45"} | ${"2024-06-20T16:00:30"}   | ${"20240615143045-20240620160030"}
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024-06-15"}          | ${"2024-06-15"}            | ${"2024061520240615"}
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"0000-01-01"}          | ${"9999-12-31"}            | ${"0000010199991231"}
    ${"edifact"} | ${"dateTimePeriod"} | ${"719"} | ${"2024-06-15T14:30:45"} | ${"2024-06-20T16:00:59.5"} | ${"202406151430202406201600"}
    ${"x12"}     | ${"dateTimeRange"}  | ${"RDT"} | ${"2024-06-15T14:30:10"} | ${"2024-06-15T14:30:45"}   | ${"202406151430-202406151430"}
    ${"x12"}     | ${"dateTimeRange"}  | ${"DTS"} | ${"2024-06-15T14:30"}    | ${"2024-06-15T14:30:45.9"} | ${"20240615143000-20240615143045"}
  `(
    "writes $start to $end under $standard $code as $expected",
    ({ standard, kind, code, start, end, expected }) => {
      expect(writeEdiRange(standard, kind, code, start, end)).toBe(expected);
    },
  );

  // GMT rule: a reversed period names no span of time. The ends are compared as given, before
  // either is cut to the mask.
  it.each`
    standard     | kind                | code     | start                    | end                      | reads
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024-06-20"}          | ${"2024-06-15"}          | ${"the end date is five days before the start"}
    ${"edifact"} | ${"dateTimePeriod"} | ${"719"} | ${"2024-06-15T14:31"}    | ${"2024-06-15T14:30"}    | ${"the end is one minute before the start"}
    ${"edifact"} | ${"dateTimePeriod"} | ${"719"} | ${"2024-06-15T14:30:45"} | ${"2024-06-15T14:30:10"} | ${"the end is 35 seconds before the start, inside one minute of the mask"}
    ${"x12"}     | ${"dateRange"}      | ${"RD"}  | ${"2025-01-01"}          | ${"2024-12-31"}          | ${"the end is the day before the start"}
    ${"x12"}     | ${"dateTimeRange"}  | ${"DTS"} | ${"2024-06-15T14:30:01"} | ${"2024-06-15T14:30:00"} | ${"the end is one second before the start"}
  `(
    "returns '' for the reversed $start to $end under $standard $code ($reads)",
    ({ standard, kind, code, start, end }) => {
      expect(writeEdiRange(standard, kind, code, start, end)).toBe("");
    },
  );

  it.each`
    standard     | kind                | code     | start                      | end                       | reads
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024-06-15T14:30"}      | ${"2024-06-20"}           | ${"a date-time start under a date period"}
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024-06-15"}            | ${"2024-06-20T16:00"}     | ${"a date-time end under a date period"}
    ${"edifact"} | ${"dateTimePeriod"} | ${"719"} | ${"2024-06-15"}            | ${"2024-06-20"}           | ${"dates under a date-time period"}
    ${"edifact"} | ${"dateTimePeriod"} | ${"719"} | ${"2024-06-15T14:30:00Z"}  | ${"2024-06-20T16:00:00Z"} | ${"instants: a period code carries no offset"}
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024-06-15"}            | ${"2023-02-29"}           | ${"an end that is not a real date"}
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024-06-15"}            | ${"+010000-01-01"}        | ${"an end outside years 0000–9999"}
    ${"edifact"} | ${"datePeriod"}     | ${"718"} | ${"2024-06-15/2024-06-20"} | ${"2024-06-20"}           | ${"an interval string is not a start"}
    ${"edifact"} | ${"datePeriod"}     | ${"719"} | ${"2024-06-15"}            | ${"2024-06-20"}           | ${"a date-time period code under a date period writer"}
    ${"edifact"} | ${"datePeriod"}     | ${"102"} | ${"2024-06-15"}            | ${"2024-06-20"}           | ${"a single date code"}
    ${"edifact"} | ${"date"}           | ${"102"} | ${"2024-06-15"}            | ${"2024-06-20"}           | ${"a single date written as a period"}
    ${"x12"}     | ${"dateRange"}      | ${"RD6"} | ${"2024-06-15"}            | ${"2024-06-20"}           | ${"a two-digit-year code: not written"}
    ${"x12"}     | ${"dateTimeRange"}  | ${"DDT"} | ${"2024-06-15T14:30"}      | ${"2024-06-20T16:00"}     | ${"a date and a date-time: not written"}
    ${"x12"}     | ${"dateRange"}      | ${"RD8"} | ${"2024-06-15"}            | ${""}                     | ${"an empty end"}
  `(
    "returns '' for $start to $end under $standard $code and $kind ($reads)",
    ({ standard, kind, code, start, end }) => {
      expect(writeEdiRange(standard, kind, code, start, end)).toBe("");
    },
  );

  it("returns '' for an end or a start that is not a string", () => {
    expect(
      writeEdiRange(
        "x12",
        "dateRange",
        "RD8",
        "2024-06-15",
        undefined as never,
      ),
    ).toBe("");
    expect(
      writeEdiRange("x12", "dateRange", "RD8", null as never, "2024-06-20"),
    ).toBe("");
    expect(
      writeEdiRange(
        "x12",
        "dateRange",
        "RD8",
        20240615 as never,
        20240620 as never,
      ),
    ).toBe("");
  });

  it("returns '' when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      writeEdiRange("x12", "dateRange", "RD8", "2024-06-15", "2024-06-20"),
    ).toBe("");
  });
});

/**
 * X12 data element 337 (Time): "HHMM, or HHMMSS, or HHMMSSD, or HHMMSSDD … D = tenths (0-9) and
 * DD = hundredths (00-99)". Every expected value is the time placed under the mask by hand: `D`
 * is the whole tenths of the second and `DD` its whole hundredths.
 */
describe("writeX12TimeElement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each`
    form          | value            | expected
    ${"HHMM"}     | ${"14:30"}       | ${"1430"}
    ${"HHMMSS"}   | ${"14:30:45"}    | ${"143045"}
    ${"HHMMSSD"}  | ${"14:30:45.1"}  | ${"1430451"}
    ${"HHMMSSDD"} | ${"14:30:45.12"} | ${"14304512"}
    ${"HHMMSSDD"} | ${"14:30:45.05"} | ${"14304505"}
    ${"HHMMSSD"}  | ${"14:30"}       | ${"1430000"}
    ${"HHMMSSDD"} | ${"14:30"}       | ${"14300000"}
    ${"HHMM"}     | ${"00:00"}       | ${"0000"}
    ${"HHMMSSDD"} | ${"00:00"}       | ${"00000000"}
    ${"HHMMSSDD"} | ${"23:59:59.99"} | ${"23595999"}
  `("writes $value under $form as $expected", ({ form, value, expected }) => {
    expect(writeX12TimeElement(form, value)).toBe(expected);
  });

  describe("precision is cut to the mask, never rounded and never refused", () => {
    // 0.999 of a second is 9 whole tenths and 99 whole hundredths, and no whole second: the
    // cut is a truncation. Digits below the millisecond are below both decimal parts.
    it.each`
      form          | value                   | expected
      ${"HHMM"}     | ${"14:30:59.999999999"} | ${"1430"}
      ${"HHMMSS"}   | ${"14:30:45.999"}       | ${"143045"}
      ${"HHMMSSD"}  | ${"14:30:45.99"}        | ${"1430459"}
      ${"HHMMSSD"}  | ${"14:30:45.999"}       | ${"1430459"}
      ${"HHMMSSD"}  | ${"14:30:45.129"}       | ${"1430451"}
      ${"HHMMSSD"}  | ${"14:30:45.09"}        | ${"1430450"}
      ${"HHMMSSDD"} | ${"14:30:45.9"}         | ${"14304590"}
      ${"HHMMSSDD"} | ${"14:30:45.999"}       | ${"14304599"}
      ${"HHMMSSDD"} | ${"14:30:45.129"}       | ${"14304512"}
      ${"HHMMSSDD"} | ${"14:30:45.009"}       | ${"14304500"}
      ${"HHMMSSDD"} | ${"14:30:45.129999999"} | ${"14304512"}
      ${"HHMMSSD"}  | ${"23:59:59.999999999"} | ${"2359599"}
      ${"HHMMSSDD"} | ${"23:59:59.999999999"} | ${"23595999"}
    `("writes $value under $form as $expected", ({ form, value, expected }) => {
      expect(writeX12TimeElement(form, value)).toBe(expected);
    });
  });

  // The value is a time, as `isValidTime` accepts it. Nothing is coerced from another kind.
  it.each`
    value                    | reads
    ${"2024-06-15T14:30:00"} | ${"a date-time"}
    ${"2024-06-15"}          | ${"a date"}
    ${"14:30:00+02:00"}      | ${"a time with an offset"}
    ${"14:30:00Z"}           | ${"a time with a UTC designator"}
    ${"T14:30"}              | ${"a leading time designator"}
    ${"1430"}                | ${"basic format: the input is extended ISO 8601"}
    ${"24:00"}               | ${"hour 24"}
    ${"23:59:60"}            | ${"a leap second"}
    ${""}                    | ${"an empty value"}
  `("returns '' for $value under every form ($reads)", ({ value }) => {
    for (const form of ["HHMM", "HHMMSS", "HHMMSSD", "HHMMSSDD"]) {
      expect(writeX12TimeElement(form, value), form).toBe("");
    }
  });

  // The form is the element's own mask, matched exactly and by own key.
  it.each`
    form             | reads
    ${"TM"}          | ${"the 1250 qualifier for HHMM"}
    ${"TS"}          | ${"the 1250 qualifier for HHMMSS"}
    ${"402"}         | ${"the 2379 code for HHMMSS"}
    ${"hhmmss"}      | ${"lower case"}
    ${"HHMMSSDDD"}   | ${"thousandths: not a form of the element"}
    ${""}            | ${"an empty form"}
    ${"__proto__"}   | ${"an inherited property name"}
    ${"constructor"} | ${"an inherited property name"}
  `("returns '' for the form '$form' ($reads)", ({ form }) => {
    expect(writeX12TimeElement(form, "14:30:45.12")).toBe("");
  });

  it.each`
    description               | value
    ${"null"}                 | ${null}
    ${"undefined"}            | ${undefined}
    ${"a number"}             | ${1430}
    ${"an array of a string"} | ${["14:30"]}
    ${"an object"}            | ${{}}
  `("returns '' for a value or a form that is $description", ({ value }) => {
    expect(writeX12TimeElement("HHMM", value as never)).toBe("");
    expect(writeX12TimeElement(value as never, "14:30")).toBe("");
  });

  it("returns '' when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(writeX12TimeElement("HHMMSSDD", "14:30")).toBe("");
  });
});
