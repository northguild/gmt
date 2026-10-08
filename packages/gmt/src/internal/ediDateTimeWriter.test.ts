import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { mockTemporalNowInstantThrow } from "../test/mocks";
import { readEdiDateTime } from "./ediDateTimeFields";
import { writeEdiDateTime } from "./ediDateTimeWriter";

const WINDOW_2000 = { yearWindow: 2000 };

// Every expected value is written by hand from the code's mask (UNTDID 2379; X12 1250 release
// 005010): the ISO value's fields are placed under the mask, each zero-padded to its
// width. 2024-06-15 14:30:45 is the fixture throughout. Each row also checks that the reader,
// which shares the writer's layout tables, reads the written value back.
describe("writeEdiDateTime: UNTDID 2379", () => {
  it.each`
    code     | mask                           | value                                  | options        | expected
    ${"101"} | ${"YYMMDD"}                    | ${"2024-06-15"}                        | ${WINDOW_2000} | ${"240615"}
    ${"102"} | ${"CCYYMMDD"}                  | ${"2024-06-15"}                        | ${undefined}   | ${"20240615"}
    ${"201"} | ${"YYMMDDHHMM"}                | ${"2024-06-15T14:30:00"}               | ${WINDOW_2000} | ${"2406151430"}
    ${"202"} | ${"YYMMDDHHMMSS"}              | ${"2024-06-15T14:30:45"}               | ${WINDOW_2000} | ${"240615143045"}
    ${"203"} | ${"CCYYMMDDHHMM"}              | ${"2024-06-15T14:30:00"}               | ${undefined}   | ${"202406151430"}
    ${"204"} | ${"CCYYMMDDHHMMSS"}            | ${"2024-06-15T14:30:45"}               | ${undefined}   | ${"20240615143045"}
    ${"205"} | ${"CCYYMMDDHHMMZHHMM"}         | ${"2024-06-15T14:30:00+02:00"}         | ${undefined}   | ${"202406151430+0200"}
    ${"205"} | ${"CCYYMMDDHHMMZHHMM"}         | ${"2024-06-15T14:30:00-05:30"}         | ${undefined}   | ${"202406151430-0530"}
    ${"206"} | ${"YYMMDDHHMMZHHMM"}           | ${"2024-06-15T14:30:00+02:00"}         | ${WINDOW_2000} | ${"2406151430+0200"}
    ${"207"} | ${"YYMMDDHHMMSSZHHMM"}         | ${"2024-06-15T14:30:45-05:30"}         | ${WINDOW_2000} | ${"240615143045-0530"}
    ${"208"} | ${"CCYYMMDDHHMMSSZHHMM"}       | ${"2024-06-15T14:30:45+02:00"}         | ${undefined}   | ${"20240615143045+0200"}
    ${"209"} | ${"HHMMSSZHHMM"}               | ${"14:30:45+02:00"}                    | ${undefined}   | ${"143045+0200"}
    ${"301"} | ${"YYMMDDHHMMZZZ"}             | ${"2024-06-15T14:30:00+02:00"}         | ${WINDOW_2000} | ${"2406151430+02"}
    ${"302"} | ${"YYMMDDHHMMSSZZZ"}           | ${"2024-06-15T14:30:45Z"}              | ${WINDOW_2000} | ${"240615143045+00"}
    ${"303"} | ${"CCYYMMDDHHMMZZZ"}           | ${"2024-06-15T14:30:00-05:00"}         | ${undefined}   | ${"202406151430-05"}
    ${"304"} | ${"CCYYMMDDHHMMSSZZZ"}         | ${"2024-06-15T14:30:45+02:00"}         | ${undefined}   | ${"20240615143045+02"}
    ${"401"} | ${"HHMM"}                      | ${"14:30"}                             | ${undefined}   | ${"1430"}
    ${"402"} | ${"HHMMSS"}                    | ${"14:30:45"}                          | ${undefined}   | ${"143045"}
    ${"404"} | ${"HHMMSSZZZ"}                 | ${"14:30:45+02:00"}                    | ${undefined}   | ${"143045+02"}
    ${"406"} | ${"ZHHMM"}                     | ${"+02:00"}                            | ${undefined}   | ${"+0200"}
    ${"406"} | ${"ZHHMM"}                     | ${"-05:30"}                            | ${undefined}   | ${"-0530"}
    ${"713"} | ${"YYMMDDHHMM-YYMMDDHHMM"}     | ${"2024-06-15T14:30/2024-06-20T16:00"} | ${WINDOW_2000} | ${"24061514302406201600"}
    ${"717"} | ${"YYMMDD-YYMMDD"}             | ${"2024-06-15/2024-06-20"}             | ${WINDOW_2000} | ${"240615240620"}
    ${"718"} | ${"CCYYMMDD-CCYYMMDD"}         | ${"2024-06-15/2024-06-20"}             | ${undefined}   | ${"2024061520240620"}
    ${"719"} | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"} | ${"2024-06-15T14:30/2024-06-20T16:00"} | ${undefined}   | ${"202406151430202406201600"}
  `(
    "writes $value under code $code ($mask) as $expected",
    ({ code, value, options, expected }) => {
      expect(writeEdiDateTime("edifact", code, value, options)).toBe(expected);
      expect(
        readEdiDateTime("edifact", code, expected, options),
      ).not.toBeNull();
    },
  );
});

describe("writeEdiDateTime: X12 1250", () => {
  // 14 June 2024 is day 166 of its year: January 31 + February 29 + March 31 + April 30 + May 31
  // = 152, then 14 days of June.
  it.each`
    code     | mask                               | value                                        | options        | expected
    ${"D8"}  | ${"CCYYMMDD"}                      | ${"2024-06-15"}                              | ${undefined}   | ${"20240615"}
    ${"D6"}  | ${"YYMMDD"}                        | ${"2024-06-15"}                              | ${WINDOW_2000} | ${"240615"}
    ${"DB"}  | ${"MMDDCCYY"}                      | ${"2024-06-15"}                              | ${undefined}   | ${"06152024"}
    ${"TT"}  | ${"MMDDYY"}                        | ${"2024-06-15"}                              | ${WINDOW_2000} | ${"061524"}
    ${"DT"}  | ${"CCYYMMDDHHMM"}                  | ${"2024-06-15T14:30"}                        | ${undefined}   | ${"202406151430"}
    ${"TR"}  | ${"DDMMYYHHMM"}                    | ${"2024-06-15T14:30"}                        | ${WINDOW_2000} | ${"1506241430"}
    ${"RTS"} | ${"CCYYMMDDHHMMSS"}                | ${"2024-06-15T14:30:45"}                     | ${undefined}   | ${"20240615143045"}
    ${"TM"}  | ${"HHMM"}                          | ${"14:30"}                                   | ${undefined}   | ${"1430"}
    ${"TS"}  | ${"HHMMSS"}                        | ${"14:30:45"}                                | ${undefined}   | ${"143045"}
    ${"RD8"} | ${"CCYYMMDD-CCYYMMDD"}             | ${"2024-06-15/2024-06-20"}                   | ${undefined}   | ${"20240615-20240620"}
    ${"RD6"} | ${"YYMMDD-YYMMDD"}                 | ${"2024-06-15/2024-06-20"}                   | ${WINDOW_2000} | ${"240615-240620"}
    ${"RD"}  | ${"MMDDCCYY-MMDDCCYY"}             | ${"2024-06-15/2024-06-20"}                   | ${undefined}   | ${"06152024-06202024"}
    ${"RDT"} | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"}     | ${"2024-06-15T14:30/2024-06-20T16:00"}       | ${undefined}   | ${"202406151430-202406201600"}
    ${"DTS"} | ${"CCYYMMDDHHMMSS-CCYYMMDDHHMMSS"} | ${"2024-06-15T14:30:45/2024-06-20T16:00:00"} | ${undefined}   | ${"20240615143045-20240620160000"}
    ${"DDT"} | ${"CCYYMMDD-CCYYMMDDHHMM"}         | ${"2024-06-15/2024-06-20T16:00"}             | ${undefined}   | ${"20240615-202406201600"}
    ${"DTD"} | ${"CCYYMMDDHHMM-CCYYMMDD"}         | ${"2024-06-15T14:30/2024-06-20"}             | ${undefined}   | ${"202406151430-20240620"}
    ${"RTM"} | ${"HHMM-HHMM"}                     | ${"09:00/17:00"}                             | ${undefined}   | ${"0900-1700"}
    ${"TC"}  | ${"DDD"}                           | ${"2024-06-14"}                              | ${undefined}   | ${"166"}
    ${"TU"}  | ${"YYDDD"}                         | ${"2024-06-14"}                              | ${WINDOW_2000} | ${"24166"}
    ${"EH"}  | ${"YDDD"}                          | ${"2024-06-14"}                              | ${undefined}   | ${"4166"}
  `(
    "writes $value under code $code ($mask) as $expected",
    ({ code, value, options, expected }) => {
      expect(writeEdiDateTime("x12", code, value, options)).toBe(expected);
      expect(readEdiDateTime("x12", code, expected, options)).not.toBeNull();
    },
  );
});

describe("writeEdiDateTime: a time-only range is written as given (GMT rule)", () => {
  // RTM carries no date, so an end before its start is a window that crosses midnight. Each
  // expected value is the two times' own hour and minute digits around X12's hyphen.
  it.each`
    value            | expected       | reads
    ${"22:00/06:00"} | ${"2200-0600"} | ${"an overnight window"}
    ${"17:00/09:00"} | ${"1700-0900"} | ${"an end eight hours before its start"}
    ${"23:59/00:00"} | ${"2359-0000"} | ${"one minute across midnight"}
    ${"06:00/06:00"} | ${"0600-0600"} | ${"equal times"}
  `("x12 RTM $value is written $expected ($reads)", ({ value, expected }) => {
    expect(writeEdiDateTime("x12", "RTM", value)).toBe(expected);
  });
});

describe("writeEdiDateTime: a value the code cannot hold is the sentinel", () => {
  it.each`
    standard     | code     | value                                        | options        | reads
    ${"edifact"} | ${"718"} | ${"2024-06-20/2024-06-15"}                   | ${undefined}   | ${"a dated period whose end precedes its start"}
    ${"edifact"} | ${"719"} | ${"2024-06-15T14:31/2024-06-15T14:30"}       | ${undefined}   | ${"a period reversed by one minute"}
    ${"x12"}     | ${"RD8"} | ${"2024-06-20/2024-06-15"}                   | ${undefined}   | ${"a dated range whose end precedes its start"}
    ${"x12"}     | ${"DTS"} | ${"2024-06-15T14:30:01/2024-06-15T14:30:00"} | ${undefined}   | ${"a range reversed by one second"}
    ${"x12"}     | ${"DDT"} | ${"2024-06-16/2024-06-15T23:59"}             | ${undefined}   | ${"an end date-time on the day before the start date"}
    ${"x12"}     | ${"DTD"} | ${"2024-06-16T00:00/2024-06-15"}             | ${undefined}   | ${"an end date before the start date-time's date"}
    ${"edifact"} | ${"101"} | ${"2024-06-15"}                              | ${undefined}   | ${"a two-digit year with no window"}
    ${"x12"}     | ${"D6"}  | ${"2024-06-15"}                              | ${{}}          | ${"a two-digit year with an empty bag"}
    ${"edifact"} | ${"101"} | ${"1969-01-01"}                              | ${WINDOW_2000} | ${"1969 is outside 2000-2099"}
    ${"x12"}     | ${"TU"}  | ${"2100-01-01"}                              | ${WINDOW_2000} | ${"2100 is outside 2000-2099"}
    ${"edifact"} | ${"102"} | ${"+010000-01-01"}                           | ${undefined}   | ${"year 10000: CCYY holds four digits"}
    ${"x12"}     | ${"D8"}  | ${"-000001-12-31"}                           | ${undefined}   | ${"year -1: CCYY holds no sign"}
    ${"x12"}     | ${"TC"}  | ${"+010000-01-01"}                           | ${undefined}   | ${"year 10000 under a mask with no year"}
    ${"edifact"} | ${"203"} | ${"2024-06-15T14:30:45"}                     | ${undefined}   | ${"seconds under a mask with no SS"}
    ${"x12"}     | ${"TM"}  | ${"14:30:45"}                                | ${undefined}   | ${"seconds under a mask with no SS"}
    ${"edifact"} | ${"204"} | ${"2024-06-15T14:30:45.5"}                   | ${undefined}   | ${"a fraction of a second"}
    ${"edifact"} | ${"303"} | ${"2024-06-15T14:30:00+05:30"}               | ${undefined}   | ${"offset minutes under ZZZ, which holds whole hours"}
    ${"edifact"} | ${"205"} | ${"2024-06-15T14:30:00+05:30:15"}            | ${undefined}   | ${"offset seconds: no mask holds them"}
    ${"edifact"} | ${"406"} | ${"+05:30:15"}                               | ${undefined}   | ${"offset seconds under ZHHMM"}
    ${"edifact"} | ${"203"} | ${"2024-06-15T14:30:00Z"}                    | ${undefined}   | ${"an instant under a code with no offset"}
    ${"edifact"} | ${"303"} | ${"2024-06-15T14:30:00"}                     | ${undefined}   | ${"a local date-time under a code with an offset"}
    ${"x12"}     | ${"DT"}  | ${"2024-06-15T14:30Z"}                       | ${undefined}   | ${"an instant: no 1250 code carries an offset"}
    ${"edifact"} | ${"102"} | ${"2024-06-15T14:30:00"}                     | ${undefined}   | ${"a date-time under a date code"}
    ${"x12"}     | ${"DT"}  | ${"2024-06-15"}                              | ${undefined}   | ${"a date under a date-time code"}
    ${"edifact"} | ${"404"} | ${"14:30:45+02:00[Europe/Berlin]"}           | ${undefined}   | ${"an annotation on a time, which has no date to check it"}
    ${"edifact"} | ${"718"} | ${"2024-06-15"}                              | ${undefined}   | ${"a single value under a period code"}
    ${"x12"}     | ${"D8"}  | ${"2024-06-15/2024-06-20"}                   | ${undefined}   | ${"an interval under a single-value code"}
    ${"x12"}     | ${"RTM"} | ${"09:00"}                                   | ${undefined}   | ${"a single time under a range code"}
    ${"x12"}     | ${"D8"}  | ${"2023-02-29"}                              | ${undefined}   | ${"29 February 2023"}
    ${"x12"}     | ${"UN"}  | ${"2024-06-15"}                              | ${undefined}   | ${"Unstructured: no mask to write"}
    ${"edifact"} | ${"602"} | ${"2024"}                                    | ${undefined}   | ${"a 2379 code GMT does not write"}
    ${"edifact"} | ${"D8"}  | ${"2024-06-15"}                              | ${undefined}   | ${"an X12 code under UN/EDIFACT"}
    ${"edi"}     | ${"102"} | ${"2024-06-15"}                              | ${undefined}   | ${"an unknown standard"}
  `(
    "$standard $code $value with options $options is '' ($reads)",
    ({ standard, code, value, options }) => {
      expect(writeEdiDateTime(standard, code, value, options)).toBe("");
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
  `(
    "returns '' when the value, the code or the standard is $description",
    ({ input }) => {
      expect(writeEdiDateTime("edifact", "102", input as never)).toBe("");
      expect(writeEdiDateTime("x12", "D8", input as never)).toBe("");
      expect(writeEdiDateTime("edifact", input as never, "2024-06-15")).toBe(
        "",
      );
      expect(writeEdiDateTime(input as never, "102", "2024-06-15")).toBe("");
    },
  );
});

describe("writeEdiDateTime: the year window", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // GMT rule: rolling is 50 years before the current UTC calendar year to 49 after it, so on
  // 2026-10-07 it is 1976-2075.
  it.each`
    value           | expected    | reads
    ${"1976-01-01"} | ${"760101"} | ${"the first year of the window"}
    ${"2075-12-31"} | ${"751231"} | ${"the last year of the window"}
    ${"1975-12-31"} | ${""}       | ${"the year before the window"}
    ${"2076-01-01"} | ${""}       | ${"the year after the window"}
  `(
    "x12 D6 $value with yearWindow \"rolling\" on 2026-10-07 is '$expected' ($reads)",
    ({ value, expected }) => {
      vi.spyOn(Temporal.Now, "instant").mockReturnValue(
        Temporal.Instant.from("2026-10-07T12:00:00Z"),
      );
      expect(
        writeEdiDateTime("x12", "D6", value, { yearWindow: "rolling" }),
      ).toBe(expected);
    },
  );

  it("a code with a four-digit year never reads the clock or the option", () => {
    const now = vi.spyOn(Temporal.Now, "instant");
    const options = {
      get yearWindow(): never {
        throw new Error("read");
      },
    };
    expect(writeEdiDateTime("edifact", "102", "2024-06-15", options)).toBe(
      "20240615",
    );
    expect(
      writeEdiDateTime("x12", "D8", "2024-06-15", { yearWindow: "rolling" }),
    ).toBe("20240615");
    expect(now).not.toHaveBeenCalled();
  });

  it("returns '' for a rolling window when the clock cannot be read", () => {
    mockTemporalNowInstantThrow();
    expect(
      writeEdiDateTime("edifact", "101", "2024-06-15", {
        yearWindow: "rolling",
      }),
    ).toBe("");
  });
});
