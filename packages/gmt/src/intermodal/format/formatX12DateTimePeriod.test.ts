import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import {
  mockTemporalNowInstantThrow,
  mockTemporalPlainDateFromThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import type { EdiDateTime } from "../../types/edi";
import { parseX12DateTimePeriod } from "../parse/parseX12DateTimePeriod";
import { isValidX12DateTimePeriod } from "../validate/isValidX12DateTimePeriod";
import { formatX12DateTimePeriod } from "./formatX12DateTimePeriod";

/**
 * Every expected value below is written by hand from the code's mask: the `mask` column is the
 * format X12 data element 1250 gives for the code (release 005010, Stedi's X12-licensed
 * dictionary), and the ISO value's fields are placed under it, each zero-padded to the mask's
 * width. The day-of-year values are checked against plain Temporal in their own block.
 */
const WINDOW_2000 = { yearWindow: 2000 };
const WINDOW_1950 = { yearWindow: 1950 };

/**
 * Values that are not strings, each named for the failure message. Built per use: a Proxy that
 * throws on every trap reaches the catch path, where the others stop at the `typeof` guard.
 */
const NON_STRINGS: [string, () => unknown][] = [
  ["null", () => null],
  ["undefined", () => undefined],
  ["a number", () => 1718461800000],
  ["a boolean", () => true],
  ["an array holding a string", () => ["2024-06-15"]],
  ["an object", () => ({})],
  ["a Proxy that throws on any trap", hostileProxy],
  ["a revoked Proxy", revokedProxy],
];

/** A getter that throws, for an options bag that cannot be read. */
function throwing(): never {
  throw new Error("hostile getter");
}

describe("formatX12DateTimePeriod", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setNow(instant: string): void {
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(
      Temporal.Instant.from(instant),
    );
  }

  describe("date codes take an ISO date", () => {
    it.each`
      formatQualifier | mask          | value           | expected
      ${"D8"}         | ${"CCYYMMDD"} | ${"2024-06-15"} | ${"20240615"}
      ${"D8"}         | ${"CCYYMMDD"} | ${"2024-02-29"} | ${"20240229"}
      ${"D8"}         | ${"CCYYMMDD"} | ${"2024-01-01"} | ${"20240101"}
      ${"D8"}         | ${"CCYYMMDD"} | ${"2024-12-31"} | ${"20241231"}
      ${"D8"}         | ${"CCYYMMDD"} | ${"0001-01-01"} | ${"00010101"}
      ${"D8"}         | ${"CCYYMMDD"} | ${"0000-01-01"} | ${"00000101"}
      ${"D8"}         | ${"CCYYMMDD"} | ${"9999-12-31"} | ${"99991231"}
      ${"DB"}         | ${"MMDDCCYY"} | ${"2024-06-15"} | ${"06152024"}
      ${"DB"}         | ${"MMDDCCYY"} | ${"2024-02-29"} | ${"02292024"}
      ${"DB"}         | ${"MMDDCCYY"} | ${"0001-01-01"} | ${"01010001"}
      ${"DB"}         | ${"MMDDCCYY"} | ${"0000-01-01"} | ${"01010000"}
      ${"DB"}         | ${"MMDDCCYY"} | ${"9999-12-31"} | ${"12319999"}
    `(
      "writes $value under $formatQualifier ($mask) as $expected",
      ({ formatQualifier, value, expected }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe(expected);
      },
    );
  });

  describe("date-time codes take a local ISO date-time", () => {
    it.each`
      formatQualifier | mask                | value                    | expected
      ${"DT"}         | ${"CCYYMMDDHHMM"}   | ${"2024-06-15T14:30"}    | ${"202406151430"}
      ${"DT"}         | ${"CCYYMMDDHHMM"}   | ${"2024-06-15T14:30:00"} | ${"202406151430"}
      ${"DT"}         | ${"CCYYMMDDHHMM"}   | ${"2024-06-15T09:05"}    | ${"202406150905"}
      ${"DT"}         | ${"CCYYMMDDHHMM"}   | ${"2024-02-29T00:00:00"} | ${"202402290000"}
      ${"DT"}         | ${"CCYYMMDDHHMM"}   | ${"0001-01-01T00:00"}    | ${"000101010000"}
      ${"RTS"}        | ${"CCYYMMDDHHMMSS"} | ${"2024-06-15T14:30:45"} | ${"20240615143045"}
      ${"RTS"}        | ${"CCYYMMDDHHMMSS"} | ${"2024-06-15T14:30"}    | ${"20240615143000"}
      ${"RTS"}        | ${"CCYYMMDDHHMMSS"} | ${"2024-12-31T23:59:59"} | ${"20241231235959"}
      ${"RTS"}        | ${"CCYYMMDDHHMMSS"} | ${"2024-06-15T09:05:07"} | ${"20240615090507"}
      ${"RTS"}        | ${"CCYYMMDDHHMMSS"} | ${"0000-01-01T00:00:00"} | ${"00000101000000"}
      ${"RTS"}        | ${"CCYYMMDDHHMMSS"} | ${"9999-12-31T23:59:59"} | ${"99991231235959"}
    `(
      "writes $value under $formatQualifier ($mask) as $expected",
      ({ formatQualifier, value, expected }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe(expected);
      },
    );
  });

  describe("time codes take an ISO time", () => {
    it.each`
      formatQualifier | mask        | value         | expected
      ${"TM"}         | ${"HHMM"}   | ${"14:30"}    | ${"1430"}
      ${"TM"}         | ${"HHMM"}   | ${"14:30:00"} | ${"1430"}
      ${"TM"}         | ${"HHMM"}   | ${"00:00:00"} | ${"0000"}
      ${"TM"}         | ${"HHMM"}   | ${"09:05"}    | ${"0905"}
      ${"TM"}         | ${"HHMM"}   | ${"23:59"}    | ${"2359"}
      ${"TS"}         | ${"HHMMSS"} | ${"14:30:45"} | ${"143045"}
      ${"TS"}         | ${"HHMMSS"} | ${"14:30"}    | ${"143000"}
      ${"TS"}         | ${"HHMMSS"} | ${"12:00:00"} | ${"120000"}
      ${"TS"}         | ${"HHMMSS"} | ${"23:59:59"} | ${"235959"}
      ${"TS"}         | ${"HHMMSS"} | ${"09:05:07"} | ${"090507"}
    `(
      "writes $value under $formatQualifier ($mask) as $expected",
      ({ formatQualifier, value, expected }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe(expected);
      },
    );
  });

  describe("range codes take an ISO 8601 interval and always write the hyphen", () => {
    it.each`
      formatQualifier | mask                               | value                                        | expected
      ${"RD8"}        | ${"CCYYMMDD-CCYYMMDD"}             | ${"2024-06-15/2024-06-20"}                   | ${"20240615-20240620"}
      ${"RD8"}        | ${"CCYYMMDD-CCYYMMDD"}             | ${"2024-12-31/2025-01-01"}                   | ${"20241231-20250101"}
      ${"RD"}         | ${"MMDDCCYY-MMDDCCYY"}             | ${"2024-06-15/2024-06-20"}                   | ${"06152024-06202024"}
      ${"RD"}         | ${"MMDDCCYY-MMDDCCYY"}             | ${"2024-12-31/2025-01-01"}                   | ${"12312024-01012025"}
      ${"RDT"}        | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"}     | ${"2024-06-15T14:30/2024-06-20T16:00"}       | ${"202406151430-202406201600"}
      ${"RDT"}        | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"}     | ${"2024-06-15T14:30:00/2024-06-20T16:00:00"} | ${"202406151430-202406201600"}
      ${"DTS"}        | ${"CCYYMMDDHHMMSS-CCYYMMDDHHMMSS"} | ${"2024-06-15T14:30:45/2024-06-20T16:00:00"} | ${"20240615143045-20240620160000"}
      ${"DTS"}        | ${"CCYYMMDDHHMMSS-CCYYMMDDHHMMSS"} | ${"2024-06-15T14:30/2024-06-20T16:00"}       | ${"20240615143000-20240620160000"}
      ${"DDT"}        | ${"CCYYMMDD-CCYYMMDDHHMM"}         | ${"2024-06-15/2024-06-20T16:00"}             | ${"20240615-202406201600"}
      ${"DTD"}        | ${"CCYYMMDDHHMM-CCYYMMDD"}         | ${"2024-06-15T14:30/2024-06-20"}             | ${"202406151430-20240620"}
      ${"RTM"}        | ${"HHMM-HHMM"}                     | ${"09:00/17:00"}                             | ${"0900-1700"}
      ${"RTM"}        | ${"HHMM-HHMM"}                     | ${"09:00:00/17:00:00"}                       | ${"0900-1700"}
      ${"RTM"}        | ${"HHMM-HHMM"}                     | ${"00:00/23:59"}                             | ${"0000-2359"}
    `(
      "writes $value under $formatQualifier ($mask) as $expected",
      ({ formatQualifier, value, expected }) => {
        const written = formatX12DateTimePeriod(value, formatQualifier);
        expect(written).toBe(expected);
        expect(written.split("-")).toHaveLength(2);
      },
    );

    // An end equal to its start is a zero-length range, not a reversed one. A date beside a
    // date-time compares by calendar date, since X12 gives the date no time of day.
    it.each`
      formatQualifier | value                                        | expected
      ${"RD8"}        | ${"2024-06-15/2024-06-15"}                   | ${"20240615-20240615"}
      ${"RD"}         | ${"2024-06-15/2024-06-15"}                   | ${"06152024-06152024"}
      ${"RDT"}        | ${"2024-06-15T14:30/2024-06-15T14:30"}       | ${"202406151430-202406151430"}
      ${"DTS"}        | ${"2024-06-15T14:30:45/2024-06-15T14:30:45"} | ${"20240615143045-20240615143045"}
      ${"DDT"}        | ${"2024-06-15/2024-06-15T00:00"}             | ${"20240615-202406150000"}
      ${"DTD"}        | ${"2024-06-15T23:59/2024-06-15"}             | ${"202406152359-20240615"}
      ${"RTM"}        | ${"09:00/09:00"}                             | ${"0900-0900"}
    `(
      "writes $formatQualifier $value, whose end is on its start, as $expected",
      ({ formatQualifier, value, expected }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe(expected);
      },
    );

    // GMT rule: RTM carries no date, so an end before its start is a window that crosses
    // midnight, not a reversed range. Each expected value is the two times' own hour and minute
    // digits around the hyphen.
    it.each`
      value                  | expected       | reads
      ${"22:00/06:00"}       | ${"2200-0600"} | ${"an overnight window"}
      ${"22:00:00/06:00:00"} | ${"2200-0600"} | ${"an overnight window with :00 seconds"}
      ${"17:00/09:00"}       | ${"1700-0900"} | ${"an end eight hours before its start"}
      ${"23:59/00:00"}       | ${"2359-0000"} | ${"one minute across midnight"}
      ${"00:01/00:00"}       | ${"0001-0000"} | ${"an end one minute before its start"}
      ${"06:00/06:00"}       | ${"0600-0600"} | ${"equal times"}
    `("writes RTM $value as $expected ($reads)", ({ value, expected }) => {
      expect(formatX12DateTimePeriod(value, "RTM")).toBe(expected);
    });
  });

  describe("two-digit-year codes need the caller's yearWindow", () => {
    // 2000 holds 2000–2099. 1950 holds 1950–2049.
    it.each`
      formatQualifier | mask               | value                      | options        | expected
      ${"D6"}         | ${"YYMMDD"}        | ${"2024-06-15"}            | ${WINDOW_2000} | ${"240615"}
      ${"D6"}         | ${"YYMMDD"}        | ${"2024-06-15"}            | ${WINDOW_1950} | ${"240615"}
      ${"D6"}         | ${"YYMMDD"}        | ${"1999-06-15"}            | ${WINDOW_1950} | ${"990615"}
      ${"D6"}         | ${"YYMMDD"}        | ${"2000-01-01"}            | ${WINDOW_2000} | ${"000101"}
      ${"D6"}         | ${"YYMMDD"}        | ${"2099-12-31"}            | ${WINDOW_2000} | ${"991231"}
      ${"D6"}         | ${"YYMMDD"}        | ${"1950-01-01"}            | ${WINDOW_1950} | ${"500101"}
      ${"D6"}         | ${"YYMMDD"}        | ${"2049-12-31"}            | ${WINDOW_1950} | ${"491231"}
      ${"D6"}         | ${"YYMMDD"}        | ${"2005-03-09"}            | ${WINDOW_2000} | ${"050309"}
      ${"TT"}         | ${"MMDDYY"}        | ${"2024-06-15"}            | ${WINDOW_2000} | ${"061524"}
      ${"TT"}         | ${"MMDDYY"}        | ${"1999-06-15"}            | ${WINDOW_1950} | ${"061599"}
      ${"TT"}         | ${"MMDDYY"}        | ${"2000-01-01"}            | ${WINDOW_2000} | ${"010100"}
      ${"TT"}         | ${"MMDDYY"}        | ${"2099-12-31"}            | ${WINDOW_2000} | ${"123199"}
      ${"TR"}         | ${"DDMMYYHHMM"}    | ${"2024-06-15T14:30"}      | ${WINDOW_2000} | ${"1506241430"}
      ${"TR"}         | ${"DDMMYYHHMM"}    | ${"1999-06-15T14:30:00"}   | ${WINDOW_1950} | ${"1506991430"}
      ${"TR"}         | ${"DDMMYYHHMM"}    | ${"2000-01-01T00:00"}      | ${WINDOW_2000} | ${"0101000000"}
      ${"TR"}         | ${"DDMMYYHHMM"}    | ${"2099-12-31T23:59"}      | ${WINDOW_2000} | ${"3112992359"}
      ${"RD6"}        | ${"YYMMDD-YYMMDD"} | ${"2024-06-15/2024-06-20"} | ${WINDOW_2000} | ${"240615-240620"}
      ${"RD6"}        | ${"YYMMDD-YYMMDD"} | ${"1999-12-31/2000-01-01"} | ${WINDOW_1950} | ${"991231-000101"}
      ${"RD6"}        | ${"YYMMDD-YYMMDD"} | ${"2000-01-01/2099-12-31"} | ${WINDOW_2000} | ${"000101-991231"}
      ${"TU"}         | ${"YYDDD"}         | ${"2024-06-14"}            | ${WINDOW_2000} | ${"24166"}
      ${"TU"}         | ${"YYDDD"}         | ${"1999-06-15"}            | ${WINDOW_1950} | ${"99166"}
      ${"TU"}         | ${"YYDDD"}         | ${"2000-12-31"}            | ${WINDOW_2000} | ${"00366"}
      ${"TU"}         | ${"YYDDD"}         | ${"2099-12-31"}            | ${WINDOW_2000} | ${"99365"}
    `(
      "writes $value under $formatQualifier ($mask) with $options as $expected",
      ({ formatQualifier, value, options, expected }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier, options)).toBe(
          expected,
        );
      },
    );

    it.each`
      formatQualifier | value
      ${"D6"}         | ${"2024-06-15"}
      ${"TT"}         | ${"2024-06-15"}
      ${"TR"}         | ${"2024-06-15T14:30"}
      ${"RD6"}        | ${"2024-06-15/2024-06-20"}
      ${"TU"}         | ${"2024-06-14"}
    `(
      "returns the sentinel for $formatQualifier $value without a window, and a value with one",
      ({ formatQualifier, value }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe("");
        expect(formatX12DateTimePeriod(value, formatQualifier, undefined)).toBe(
          "",
        );
        expect(formatX12DateTimePeriod(value, formatQualifier, {})).toBe("");
        expect(
          formatX12DateTimePeriod(value, formatQualifier, {
            yearWindow: undefined,
          }),
        ).toBe("");
        expect(
          formatX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).not.toBe("");
      },
    );

    it.each`
      yearWindow                  | reads
      ${null}                     | ${"null"}
      ${"2000"}                   | ${"a numeric string"}
      ${"Rolling"}                | ${"rolling in another case"}
      ${1999.5}                   | ${"a non-integer"}
      ${-1}                       | ${"below 0"}
      ${9901}                     | ${"above 9900"}
      ${Number.NaN}               | ${"NaN"}
      ${Number.POSITIVE_INFINITY} | ${"Infinity"}
    `(
      "returns the sentinel for D6 2024-06-15 with yearWindow $yearWindow ($reads)",
      ({ yearWindow }) => {
        expect(
          formatX12DateTimePeriod("2024-06-15", "D6", { yearWindow } as never),
        ).toBe("");
      },
    );

    // A year outside the window has no two-digit form in it: writing 1969 as 69 would read back
    // as 2069 in a 2000–2099 window, so a round-trip would change the century.
    it.each`
      formatQualifier | value                      | options        | reads
      ${"D6"}         | ${"1969-01-01"}            | ${WINDOW_2000} | ${"1969 is before 2000–2099"}
      ${"D6"}         | ${"1999-12-31"}            | ${WINDOW_2000} | ${"the day before the window"}
      ${"D6"}         | ${"2100-01-01"}            | ${WINDOW_2000} | ${"the day after the window"}
      ${"D6"}         | ${"1949-12-31"}            | ${WINDOW_1950} | ${"the day before 1950–2049"}
      ${"D6"}         | ${"2050-01-01"}            | ${WINDOW_1950} | ${"the day after 1950–2049"}
      ${"TT"}         | ${"1969-01-01"}            | ${WINDOW_2000} | ${"1969 is before 2000–2099"}
      ${"TT"}         | ${"2100-01-01"}            | ${WINDOW_2000} | ${"the day after the window"}
      ${"TR"}         | ${"1999-12-31T23:59"}      | ${WINDOW_2000} | ${"the minute before the window"}
      ${"TR"}         | ${"2100-01-01T00:00"}      | ${WINDOW_2000} | ${"the minute after the window"}
      ${"TU"}         | ${"1999-12-31"}            | ${WINDOW_2000} | ${"the day before the window"}
      ${"TU"}         | ${"2100-01-01"}            | ${WINDOW_2000} | ${"the day after the window"}
      ${"RD6"}        | ${"1999-12-31/2000-01-01"} | ${WINDOW_2000} | ${"the start is before the window"}
      ${"RD6"}        | ${"2099-12-31/2100-01-01"} | ${WINDOW_2000} | ${"the end is after the window"}
    `(
      "returns the sentinel for $formatQualifier $value with $options ($reads)",
      ({ formatQualifier, value, options }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier, options)).toBe(
          "",
        );
      },
    );

    it.each`
      yearWindow | value           | expected
      ${0}       | ${"0024-06-15"} | ${"240615"}
      ${0}       | ${"0099-12-31"} | ${"991231"}
      ${0}       | ${"0100-01-01"} | ${""}
      ${9900}    | ${"9924-06-15"} | ${"240615"}
      ${9900}    | ${"9999-12-31"} | ${"991231"}
      ${9900}    | ${"9899-12-31"} | ${""}
    `(
      "writes D6 $value at the window limit $yearWindow as '$expected'",
      ({ yearWindow, value, expected }) => {
        expect(formatX12DateTimePeriod(value, "D6", { yearWindow })).toBe(
          expected,
        );
      },
    );

    // GMT rule: "rolling" is 50 years before the current UTC calendar year to 49 after it:
    // 1976–2075 on 2026-10-07, and 2000–2099 on 2050-01-01.
    it.each`
      now                            | window                                      | value           | expected
      ${"2026-10-07T12:00:00Z"}      | ${"1976–2075"}                              | ${"2024-06-15"} | ${"240615"}
      ${"2026-10-07T12:00:00Z"}      | ${"1976–2075"}                              | ${"1976-01-01"} | ${"760101"}
      ${"2026-10-07T12:00:00Z"}      | ${"1976–2075"}                              | ${"2075-12-31"} | ${"751231"}
      ${"2026-10-07T12:00:00Z"}      | ${"1976–2075"}                              | ${"1975-12-31"} | ${""}
      ${"2026-10-07T12:00:00Z"}      | ${"1976–2075"}                              | ${"2076-01-01"} | ${""}
      ${"2049-12-31T23:59:59Z"}      | ${"1999–2098"}                              | ${"1999-06-15"} | ${"990615"}
      ${"2050-01-01T00:00:00Z"}      | ${"2000–2099"}                              | ${"1999-06-15"} | ${""}
      ${"2050-01-01T00:00:00Z"}      | ${"2000–2099"}                              | ${"2099-06-15"} | ${"990615"}
      ${"2050-01-01T00:00:00+02:00"} | ${"1999–2098: 22:00Z on 31 December 2049"}  | ${"1999-06-15"} | ${"990615"}
      ${"2049-12-31T23:59:59-05:00"} | ${"2000–2099: 04:59:59Z on 1 January 2050"} | ${"1999-06-15"} | ${""}
      ${"2049-12-31T23:59:59-05:00"} | ${"2000–2099: 04:59:59Z on 1 January 2050"} | ${"2099-06-15"} | ${"990615"}
    `(
      "writes D6 $value with yearWindow \"rolling\" at $now ($window) as '$expected'",
      ({ now, value, expected }) => {
        setNow(now);
        expect(
          formatX12DateTimePeriod(value, "D6", { yearWindow: "rolling" }),
        ).toBe(expected);
      },
    );

    // On 2026-10-07 the rolling window is 1976–2075. 2075 has 365 days, so its last day is 365.
    it.each`
      formatQualifier | value                      | expected
      ${"TT"}         | ${"2024-06-15"}            | ${"061524"}
      ${"TT"}         | ${"1975-12-31"}            | ${""}
      ${"TR"}         | ${"2024-06-15T14:30"}      | ${"1506241430"}
      ${"TR"}         | ${"2076-01-01T00:00"}      | ${""}
      ${"RD6"}        | ${"1976-01-01/2075-12-31"} | ${"760101-751231"}
      ${"RD6"}        | ${"1975-12-31/1976-01-01"} | ${""}
      ${"TU"}         | ${"2075-12-31"}            | ${"75365"}
      ${"TU"}         | ${"2076-01-01"}            | ${""}
    `(
      "writes $formatQualifier $value with yearWindow \"rolling\" on 2026-10-07 as '$expected'",
      ({ formatQualifier, value, expected }) => {
        setNow("2026-10-07T12:00:00Z");
        expect(Temporal.PlainDate.from("2075-12-31").dayOfYear).toBe(365);
        expect(
          formatX12DateTimePeriod(value, formatQualifier, {
            yearWindow: "rolling",
          }),
        ).toBe(expected);
      },
    );

    it("returns the sentinel for a rolling window when the clock cannot be read", () => {
      mockTemporalNowInstantThrow();
      expect(
        formatX12DateTimePeriod("2024-06-15", "D6", { yearWindow: "rolling" }),
      ).toBe("");
    });

    it("writes with a fixed window, and a four-digit code with a rolling one, without the clock", () => {
      mockTemporalNowInstantThrow();
      expect(formatX12DateTimePeriod("2024-06-15", "D6", WINDOW_2000)).toBe(
        "240615",
      );
      expect(
        formatX12DateTimePeriod("2024-06-15", "D8", { yearWindow: "rolling" }),
      ).toBe("20240615");
    });

    it.each`
      formatQualifier | value                                        | expected
      ${"D8"}         | ${"1969-01-01"}                              | ${"19690101"}
      ${"DB"}         | ${"1969-01-01"}                              | ${"01011969"}
      ${"DT"}         | ${"1969-01-01T14:30"}                        | ${"196901011430"}
      ${"RTS"}        | ${"1969-01-01T14:30:45"}                     | ${"19690101143045"}
      ${"TM"}         | ${"14:30"}                                   | ${"1430"}
      ${"TS"}         | ${"14:30:45"}                                | ${"143045"}
      ${"RD8"}        | ${"1969-01-01/1969-01-02"}                   | ${"19690101-19690102"}
      ${"RD"}         | ${"1969-01-01/1969-01-02"}                   | ${"01011969-01021969"}
      ${"RDT"}        | ${"1969-01-01T14:30/1969-01-02T16:00"}       | ${"196901011430-196901021600"}
      ${"DTS"}        | ${"1969-01-01T14:30:45/1969-01-02T16:00:00"} | ${"19690101143045-19690102160000"}
      ${"DDT"}        | ${"1969-01-01/1969-01-02T16:00"}             | ${"19690101-196901021600"}
      ${"DTD"}        | ${"1969-01-01T14:30/1969-01-02"}             | ${"196901011430-19690102"}
      ${"RTM"}        | ${"09:00/17:00"}                             | ${"0900-1700"}
      ${"TC"}         | ${"1969-01-01"}                              | ${"001"}
      ${"EH"}         | ${"1969-01-01"}                              | ${"9001"}
    `(
      "$formatQualifier has no two-digit year and ignores yearWindow: $value is $expected with none, 2000 and an invalid one",
      ({ formatQualifier, value, expected }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe(expected);
        expect(formatX12DateTimePeriod(value, formatQualifier, {})).toBe(
          expected,
        );
        expect(
          formatX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).toBe(expected);
        expect(
          formatX12DateTimePeriod(value, formatQualifier, {
            yearWindow: 9901,
          }),
        ).toBe(expected);
      },
    );
  });

  describe("ordinal codes are written from an ISO date", () => {
    // The day of the year, by plain Temporal: 2024 is a leap year, so 14 June is day
    // 31 + 29 + 31 + 30 + 31 + 14 = 166, and 1 March is day 61, where 2023 has it on day 60.
    it.each`
      date            | dayOfYear
      ${"2024-01-01"} | ${1}
      ${"2024-02-29"} | ${60}
      ${"2024-03-01"} | ${61}
      ${"2023-03-01"} | ${60}
      ${"2024-06-14"} | ${166}
      ${"2023-06-15"} | ${166}
      ${"2024-12-31"} | ${366}
      ${"2023-12-31"} | ${365}
      ${"1999-06-15"} | ${166}
      ${"0009-03-05"} | ${64}
    `("$date is day $dayOfYear of its year", ({ date, dayOfYear }) => {
      expect(Temporal.PlainDate.from(date).dayOfYear).toBe(dayOfYear);
    });

    it.each`
      formatQualifier | mask       | value           | options        | expected
      ${"TC"}         | ${"DDD"}   | ${"2024-06-14"} | ${undefined}   | ${"166"}
      ${"TC"}         | ${"DDD"}   | ${"2023-06-15"} | ${undefined}   | ${"166"}
      ${"TC"}         | ${"DDD"}   | ${"2024-01-01"} | ${undefined}   | ${"001"}
      ${"TC"}         | ${"DDD"}   | ${"2024-03-01"} | ${undefined}   | ${"061"}
      ${"TC"}         | ${"DDD"}   | ${"2023-03-01"} | ${undefined}   | ${"060"}
      ${"TC"}         | ${"DDD"}   | ${"2024-12-31"} | ${undefined}   | ${"366"}
      ${"TC"}         | ${"DDD"}   | ${"2023-12-31"} | ${undefined}   | ${"365"}
      ${"TU"}         | ${"YYDDD"} | ${"2024-06-14"} | ${WINDOW_2000} | ${"24166"}
      ${"TU"}         | ${"YYDDD"} | ${"2024-01-01"} | ${WINDOW_2000} | ${"24001"}
      ${"TU"}         | ${"YYDDD"} | ${"2024-12-31"} | ${WINDOW_2000} | ${"24366"}
      ${"TU"}         | ${"YYDDD"} | ${"2023-12-31"} | ${WINDOW_2000} | ${"23365"}
      ${"TU"}         | ${"YYDDD"} | ${"2000-01-01"} | ${WINDOW_2000} | ${"00001"}
      ${"EH"}         | ${"YDDD"}  | ${"2024-06-14"} | ${undefined}   | ${"4166"}
      ${"EH"}         | ${"YDDD"}  | ${"2020-01-01"} | ${undefined}   | ${"0001"}
      ${"EH"}         | ${"YDDD"}  | ${"2023-12-31"} | ${undefined}   | ${"3365"}
      ${"EH"}         | ${"YDDD"}  | ${"2024-12-31"} | ${undefined}   | ${"4366"}
      ${"EH"}         | ${"YDDD"}  | ${"0009-03-05"} | ${undefined}   | ${"9064"}
    `(
      "writes $value under $formatQualifier ($mask) as $expected",
      ({ formatQualifier, value, options, expected }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier, options)).toBe(
          expected,
        );
      },
    );

    // TC drops the year and EH all but its last digit, so two dates share one value.
    it.each`
      formatQualifier | first           | second          | expected
      ${"TC"}         | ${"2024-01-01"} | ${"1969-01-01"} | ${"001"}
      ${"TC"}         | ${"2024-06-14"} | ${"2023-06-15"} | ${"166"}
      ${"EH"}         | ${"2024-01-01"} | ${"2014-01-01"} | ${"4001"}
      ${"EH"}         | ${"2024-01-01"} | ${"1994-01-01"} | ${"4001"}
    `(
      "$formatQualifier is lossy: $first and $second are both $expected",
      ({ formatQualifier, first, second, expected }) => {
        expect(formatX12DateTimePeriod(first, formatQualifier)).toBe(expected);
        expect(formatX12DateTimePeriod(second, formatQualifier)).toBe(expected);
      },
    );

    it.each`
      formatQualifier | value         | reads
      ${"TC"}         | ${"166"}      | ${"the X12 value itself, not an ISO date"}
      ${"TC"}         | ${"2024-166"} | ${"an ISO 8601 ordinal date: the calendar date is the form taken"}
      ${"TU"}         | ${"2024-166"} | ${"an ISO 8601 ordinal date"}
      ${"EH"}         | ${"4166"}     | ${"the X12 value itself"}
    `(
      "returns the sentinel for $formatQualifier $value ($reads)",
      ({ formatQualifier, value }) => {
        expect(
          formatX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).toBe("");
      },
    );
  });

  describe("round-trips through parseX12DateTimePeriod", () => {
    // `parsed` is what the ISO value states, written by hand in the parser's result shape: the
    // date, the wall clock to the second, and for a range the same for the end.
    it.each`
      formatQualifier | value                                        | options        | parsed
      ${"D8"}         | ${"2024-06-15"}                              | ${undefined}   | ${{ date: "2024-06-15" }}
      ${"D6"}         | ${"2024-06-15"}                              | ${WINDOW_2000} | ${{ date: "2024-06-15" }}
      ${"D6"}         | ${"1999-06-15"}                              | ${WINDOW_1950} | ${{ date: "1999-06-15" }}
      ${"DB"}         | ${"2024-06-15"}                              | ${undefined}   | ${{ date: "2024-06-15" }}
      ${"TT"}         | ${"2024-06-15"}                              | ${WINDOW_2000} | ${{ date: "2024-06-15" }}
      ${"DT"}         | ${"2024-06-15T14:30"}                        | ${undefined}   | ${{ local: "2024-06-15T14:30:00" }}
      ${"TR"}         | ${"2024-06-15T14:30"}                        | ${WINDOW_2000} | ${{ local: "2024-06-15T14:30:00" }}
      ${"RTS"}        | ${"2024-06-15T14:30:45"}                     | ${undefined}   | ${{ local: "2024-06-15T14:30:45" }}
      ${"TM"}         | ${"14:30"}                                   | ${undefined}   | ${{ time: "14:30:00" }}
      ${"TS"}         | ${"14:30:45"}                                | ${undefined}   | ${{ time: "14:30:45" }}
      ${"RD8"}        | ${"2024-06-15/2024-06-20"}                   | ${undefined}   | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
      ${"RD6"}        | ${"2024-06-15/2024-06-20"}                   | ${WINDOW_2000} | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
      ${"RD6"}        | ${"1999-12-31/2000-01-01"}                   | ${WINDOW_1950} | ${{ date: "1999-12-31", periodEnd: { date: "2000-01-01" } }}
      ${"RD"}         | ${"2024-06-15/2024-06-20"}                   | ${undefined}   | ${{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }}
      ${"RDT"}        | ${"2024-06-15T14:30/2024-06-20T16:00"}       | ${undefined}   | ${{ local: "2024-06-15T14:30:00", periodEnd: { local: "2024-06-20T16:00:00" } }}
      ${"DTS"}        | ${"2024-06-15T14:30:45/2024-06-20T16:00:00"} | ${undefined}   | ${{ local: "2024-06-15T14:30:45", periodEnd: { local: "2024-06-20T16:00:00" } }}
      ${"DDT"}        | ${"2024-06-15/2024-06-20T16:00"}             | ${undefined}   | ${{ date: "2024-06-15", periodEnd: { local: "2024-06-20T16:00:00" } }}
      ${"DTD"}        | ${"2024-06-15T14:30/2024-06-20"}             | ${undefined}   | ${{ local: "2024-06-15T14:30:00", periodEnd: { date: "2024-06-20" } }}
      ${"RTM"}        | ${"09:00/17:00"}                             | ${undefined}   | ${{ time: "09:00:00", periodEnd: { time: "17:00:00" } }}
      ${"RTM"}        | ${"22:00/06:00"}                             | ${undefined}   | ${{ time: "22:00:00", periodEnd: { time: "06:00:00" } }}
      ${"TU"}         | ${"2024-06-14"}                              | ${WINDOW_2000} | ${{ date: "2024-06-14", dayOfYear: 166 }}
      ${"TU"}         | ${"2024-12-31"}                              | ${WINDOW_2000} | ${{ date: "2024-12-31", dayOfYear: 366 }}
    `(
      "$formatQualifier is lossless: $value written and read back states $parsed",
      ({ formatQualifier, value, options, parsed }) => {
        const written = formatX12DateTimePeriod(
          value,
          formatQualifier,
          options,
        );
        expect(written).not.toBe("");
        expect(
          parseX12DateTimePeriod(written, formatQualifier, options),
        ).toStrictEqual(parsed);
      },
    );

    // TU keeps the whole date: the year and the day of the year name it. 14 June is day 166 of
    // the leap year 2024, by plain Temporal, so `24166` reads back as the date that was written,
    // and that `date` is what the formatter takes.
    it("TU 2024-06-14 writes 24166, which reads back as the same date and writes back the same value", () => {
      expect(Temporal.PlainDate.from("2024-06-14").dayOfYear).toBe(166);
      const written = formatX12DateTimePeriod("2024-06-14", "TU", WINDOW_2000);
      expect(written).toBe("24166");
      const parsed = parseX12DateTimePeriod(written, "TU", WINDOW_2000);
      expect(parsed).toStrictEqual({ date: "2024-06-14", dayOfYear: 166 });
      expect(
        formatX12DateTimePeriod(parsed?.date ?? "", "TU", WINDOW_2000),
      ).toBe("24166");
    });

    // The documented loss: TC keeps the day of the year only, EH the day and one digit of the year.
    it.each`
      formatQualifier | value           | parsed
      ${"TC"}         | ${"2024-06-14"} | ${{ dayOfYear: 166 }}
      ${"TC"}         | ${"2024-12-31"} | ${{ dayOfYear: 366 }}
      ${"EH"}         | ${"2024-06-14"} | ${{ yearDigit: 4, dayOfYear: 166 }}
      ${"EH"}         | ${"2020-01-01"} | ${{ yearDigit: 0, dayOfYear: 1 }}
    `(
      "$formatQualifier is lossy: $value written and read back states only $parsed",
      ({ formatQualifier, value, parsed }) => {
        const result = parseX12DateTimePeriod(
          formatX12DateTimePeriod(value, formatQualifier),
          formatQualifier,
        );
        expect(result).toStrictEqual(parsed);
        expect(result).not.toHaveProperty("year");
        expect(result).not.toHaveProperty("date");
      },
    );

    /** A parsed result as the one ISO string the formatter takes for the same code. */
    function isoOf(parsed: EdiDateTime): string {
      const start = parsed.date ?? parsed.local ?? parsed.time ?? "";
      const end = parsed.periodEnd;
      return end === undefined
        ? start
        : `${start}/${end.date ?? end.local ?? end.time ?? ""}`;
    }

    // The other direction: a transmitted value, read and written again, is the same characters.
    it.each`
      formatQualifier | wire                               | options
      ${"D8"}         | ${"20240615"}                      | ${undefined}
      ${"D6"}         | ${"240615"}                        | ${WINDOW_2000}
      ${"DB"}         | ${"06152024"}                      | ${undefined}
      ${"TT"}         | ${"061524"}                        | ${WINDOW_2000}
      ${"DT"}         | ${"202406151430"}                  | ${undefined}
      ${"TR"}         | ${"1506241430"}                    | ${WINDOW_2000}
      ${"RTS"}        | ${"20240615143000"}                | ${undefined}
      ${"TM"}         | ${"1430"}                          | ${undefined}
      ${"TS"}         | ${"143045"}                        | ${undefined}
      ${"RD8"}        | ${"20240615-20240620"}             | ${undefined}
      ${"RD6"}        | ${"991231-000101"}                 | ${WINDOW_1950}
      ${"RD"}         | ${"06152024-06202024"}             | ${undefined}
      ${"RDT"}        | ${"202406151430-202406201600"}     | ${undefined}
      ${"DTS"}        | ${"20240615143045-20240620160000"} | ${undefined}
      ${"DDT"}        | ${"20240615-202406201600"}         | ${undefined}
      ${"DTD"}        | ${"202406151430-20240620"}         | ${undefined}
      ${"RTM"}        | ${"0900-1700"}                     | ${undefined}
      ${"RTM"}        | ${"2200-0600"}                     | ${undefined}
    `(
      "$formatQualifier $wire read and written again is $wire",
      ({ formatQualifier, wire, options }) => {
        const parsed = parseX12DateTimePeriod(wire, formatQualifier, options);
        expect(parsed).not.toBeNull();
        expect(
          formatX12DateTimePeriod(
            isoOf(parsed as EdiDateTime),
            formatQualifier,
            options,
          ),
        ).toBe(wire);
      },
    );

    // Whatever is written is a value the validator accepts under the same code and options.
    it.each`
      formatQualifier | value                            | options
      ${"D8"}         | ${"0000-01-01"}                  | ${undefined}
      ${"D8"}         | ${"9999-12-31"}                  | ${undefined}
      ${"D6"}         | ${"2099-12-31"}                  | ${WINDOW_2000}
      ${"DB"}         | ${"0001-01-01"}                  | ${undefined}
      ${"RTS"}        | ${"2024-12-31T23:59:59"}         | ${undefined}
      ${"RD8"}        | ${"2024-06-15/2024-06-15"}       | ${undefined}
      ${"DDT"}        | ${"2024-06-15/2024-06-15T00:00"} | ${undefined}
      ${"DTD"}        | ${"2024-06-15T23:59/2024-06-15"} | ${undefined}
      ${"RTM"}        | ${"09:00/09:00"}                 | ${undefined}
      ${"RTM"}        | ${"22:00/06:00"}                 | ${undefined}
      ${"TC"}         | ${"2024-12-31"}                  | ${undefined}
      ${"TU"}         | ${"2024-12-31"}                  | ${WINDOW_2000}
      ${"EH"}         | ${"2024-12-31"}                  | ${undefined}
    `(
      "what $formatQualifier writes for $value is valid under $formatQualifier",
      ({ formatQualifier, value, options }) => {
        const written = formatX12DateTimePeriod(
          value,
          formatQualifier,
          options,
        );
        expect(written).not.toBe("");
        expect(
          isValidX12DateTimePeriod(written, formatQualifier, options),
        ).toBe(true);
      },
    );
  });

  describe("a value the code cannot hold returns the sentinel", () => {
    // A minute-precision code has no seconds field. `:00` may be dropped; any other second is
    // data the code cannot carry.
    it.each`
      formatQualifier | value                                     | options        | reads
      ${"DT"}         | ${"2024-06-15T14:30:45"}                  | ${undefined}   | ${"45 seconds under CCYYMMDDHHMM"}
      ${"DT"}         | ${"2024-06-15T14:30:01"}                  | ${undefined}   | ${"one second"}
      ${"TR"}         | ${"2024-06-15T14:30:45"}                  | ${WINDOW_2000} | ${"45 seconds under DDMMYYHHMM"}
      ${"TM"}         | ${"14:30:45"}                             | ${undefined}   | ${"45 seconds under HHMM"}
      ${"RDT"}        | ${"2024-06-15T14:30:45/2024-06-20T16:00"} | ${undefined}   | ${"seconds in the start"}
      ${"RDT"}        | ${"2024-06-15T14:30/2024-06-20T16:00:01"} | ${undefined}   | ${"seconds in the end"}
      ${"DDT"}        | ${"2024-06-15/2024-06-20T16:00:30"}       | ${undefined}   | ${"seconds in the end"}
      ${"DTD"}        | ${"2024-06-15T14:30:30/2024-06-20"}       | ${undefined}   | ${"seconds in the start"}
      ${"RTM"}        | ${"09:00:30/17:00"}                       | ${undefined}   | ${"seconds in the start"}
      ${"RTM"}        | ${"09:00/17:00:30"}                       | ${undefined}   | ${"seconds in the end"}
    `(
      "returns the sentinel for $formatQualifier $value ($reads)",
      ({ formatQualifier, value, options }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier, options)).toBe(
          "",
        );
      },
    );

    // No 1250 code has a field below the second.
    it.each`
      formatQualifier | value                                           | reads
      ${"RTS"}        | ${"2024-06-15T14:30:45.5"}                      | ${"half a second"}
      ${"RTS"}        | ${"2024-06-15T14:30:45.000000001"}              | ${"one nanosecond"}
      ${"RTS"}        | ${"2024-06-15T14:30:45,5"}                      | ${"a comma fraction"}
      ${"DT"}         | ${"2024-06-15T14:30:00.001"}                    | ${"one millisecond past the minute"}
      ${"TS"}         | ${"14:30:45.123"}                               | ${"milliseconds"}
      ${"TS"}         | ${"14:30:45.000001"}                            | ${"one microsecond"}
      ${"TM"}         | ${"14:30:00.5"}                                 | ${"half a second past the minute"}
      ${"DTS"}        | ${"2024-06-15T14:30:45.5/2024-06-20T16:00:00"}  | ${"a fraction in the start"}
      ${"DTS"}        | ${"2024-06-15T14:30:45/2024-06-20T16:00:00.25"} | ${"a fraction in the end"}
    `(
      "returns the sentinel for $formatQualifier $value ($reads)",
      ({ formatQualifier, value }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe("");
      },
    );

    // The output is built from the value's fields, so a fraction that is zero is no fraction.
    it.each`
      formatQualifier | value                        | expected
      ${"RTS"}        | ${"2024-06-15T14:30:45.000"} | ${"20240615143045"}
      ${"DT"}         | ${"2024-06-15T14:30:00.000"} | ${"202406151430"}
      ${"TM"}         | ${"14:30:00.000000000"}      | ${"1430"}
      ${"TS"}         | ${"14:30:45.0"}              | ${"143045"}
    `(
      "writes $formatQualifier $value, whose fraction is zero, as $expected",
      ({ formatQualifier, value, expected }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe(expected);
      },
    );

    // No 1250 code carries an offset: the segment's 623 time code does. An instant is not
    // silently written as its UTC wall clock or as its local one.
    it.each`
      formatQualifier | value                                         | reads
      ${"DT"}         | ${"2024-06-15T14:30Z"}                        | ${"a UTC designator"}
      ${"DT"}         | ${"2024-06-15T14:30:00Z"}                     | ${"a UTC designator"}
      ${"DT"}         | ${"2024-06-15T14:30+02:00"}                   | ${"an offset"}
      ${"DT"}         | ${"2024-06-15T14:30-04:00[America/New_York]"} | ${"an offset and a zone"}
      ${"RTS"}        | ${"2024-06-15T14:30:45Z"}                     | ${"a UTC designator"}
      ${"RTS"}        | ${"2024-06-15T14:30:45+00:00"}                | ${"a zero offset"}
      ${"TM"}         | ${"14:30Z"}                                   | ${"a UTC designator on a time"}
      ${"TS"}         | ${"14:30:45+02:00"}                           | ${"an offset on a time"}
      ${"D8"}         | ${"2024-06-15Z"}                              | ${"a UTC designator on a date"}
      ${"RDT"}        | ${"2024-06-15T14:30Z/2024-06-20T16:00Z"}      | ${"instants in a range"}
      ${"RDT"}        | ${"2024-06-15T14:30/2024-06-20T16:00+02:00"}  | ${"an offset on the end only"}
    `(
      "returns the sentinel for $formatQualifier $value ($reads)",
      ({ formatQualifier, value }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe("");
      },
    );

    // The code fixes the kind of ISO value: a date, a time, a local date-time, or an interval of
    // the matching kinds.
    it.each`
      formatQualifier | value                                        | reads
      ${"D8"}         | ${"2024-06-15T14:30"}                        | ${"a date-time under a date code"}
      ${"D8"}         | ${"14:30"}                                   | ${"a time under a date code"}
      ${"D8"}         | ${"2024-06-15/2024-06-20"}                   | ${"an interval under a single-date code"}
      ${"D8"}         | ${"20240615"}                                | ${"the X12 value itself: basic format is not taken"}
      ${"D8"}         | ${"2024-06"}                                 | ${"a year and month"}
      ${"D8"}         | ${"2024-W24-6"}                              | ${"an ISO week date"}
      ${"DB"}         | ${"06/15/2024"}                              | ${"a US-style date"}
      ${"DT"}         | ${"2024-06-15"}                              | ${"a date under a date-time code"}
      ${"DT"}         | ${"14:30"}                                   | ${"a time under a date-time code"}
      ${"DT"}         | ${"2024-06-15 14:30"}                        | ${"a space for the T"}
      ${"RTS"}        | ${"2024-06-15T14:30:45/2024-06-20T16:00:00"} | ${"an interval under RTS, which is one date-time"}
      ${"TM"}         | ${"2024-06-15T14:30"}                        | ${"a date-time under a time code"}
      ${"TM"}         | ${"2024-06-15"}                              | ${"a date under a time code"}
      ${"TM"}         | ${"1430"}                                    | ${"the X12 value itself"}
      ${"TM"}         | ${"T14:30"}                                  | ${"a time designator"}
      ${"RD8"}        | ${"2024-06-15"}                              | ${"a single date under a range code"}
      ${"RD8"}        | ${"2024-06-15T14:30/2024-06-20T16:00"}       | ${"date-times under a date range"}
      ${"RD8"}        | ${"2024-06-15/2024-06-20T16:00"}             | ${"DDT's interval under RD8"}
      ${"RDT"}        | ${"2024-06-15/2024-06-20"}                   | ${"dates under a date-time range"}
      ${"DTS"}        | ${"2024-06-15T14:30:45"}                     | ${"a single date-time under DTS, which is a range"}
      ${"DDT"}        | ${"2024-06-15/2024-06-20"}                   | ${"a date for the end, which is a date-time"}
      ${"DDT"}        | ${"2024-06-15T14:30/2024-06-20T16:00"}       | ${"a date-time for the start, which is a date"}
      ${"DDT"}        | ${"2024-06-15T14:30/2024-06-20"}             | ${"DTD's interval under DDT"}
      ${"DTD"}        | ${"2024-06-15/2024-06-20T16:00"}             | ${"DDT's interval under DTD"}
      ${"DTD"}        | ${"2024-06-15T14:30/2024-06-20T16:00"}       | ${"a date-time for the end, which is a date"}
      ${"RTM"}        | ${"09:00"}                                   | ${"a single time under a range code"}
      ${"RTM"}        | ${"2024-06-15T09:00/2024-06-15T17:00"}       | ${"date-times under a time range"}
      ${"TC"}         | ${"2024-06-14T14:30"}                        | ${"a date-time under an ordinal code"}
    `(
      "returns the sentinel for $formatQualifier $value ($reads)",
      ({ formatQualifier, value }) => {
        expect(
          formatX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).toBe("");
      },
    );

    it.each`
      value                                 | reads
      ${"2024-06-15/"}                      | ${"a start and a solidus with no end"}
      ${"/2024-06-20"}                      | ${"an end with no start"}
      ${"/"}                                | ${"a solidus alone"}
      ${"2024-06-15/2024-06-20/2024-06-25"} | ${"three parts"}
      ${"2024-06-15//2024-06-20"}           | ${"two solidi"}
      ${"2024-06-15--2024-06-20"}           | ${"a double hyphen"}
      ${"2024-06-15-2024-06-20"}            | ${"a hyphen: the X12 separator, not the ISO one"}
      ${"2024-06-15 / 2024-06-20"}          | ${"a spaced solidus"}
      ${"2024-06-15/P5D"}                   | ${"a start and a duration: only start and end is taken"}
      ${"P5D/2024-06-20"}                   | ${"a duration and an end"}
      ${"2024-06-15/06-20"}                 | ${"an end shortened to its changed fields"}
      ${"2024-06-15/2024-06-31"}            | ${"31 June in the end"}
      ${"2023-02-29/2024-06-20"}            | ${"29 February 2023 in the start"}
    `("returns the sentinel for RD8 $value ($reads)", ({ value }) => {
      expect(formatX12DateTimePeriod(value, "RD8")).toBe("");
    });

    // GMT rule: a reversed range names no span of time, and the parser would refuse the result.
    it.each`
      formatQualifier | value                                        | options        | reads
      ${"RD8"}        | ${"2024-06-20/2024-06-15"}                   | ${undefined}   | ${"the end date is five days before the start"}
      ${"RD8"}        | ${"2024-06-16/2024-06-15"}                   | ${undefined}   | ${"the end date is the day before the start"}
      ${"RD6"}        | ${"2024-06-20/2024-06-15"}                   | ${WINDOW_2000} | ${"two-digit years"}
      ${"RD"}         | ${"2025-01-01/2024-12-31"}                   | ${undefined}   | ${"across a year end"}
      ${"RDT"}        | ${"2024-06-15T14:31/2024-06-15T14:30"}       | ${undefined}   | ${"one minute"}
      ${"DTS"}        | ${"2024-06-15T14:30:01/2024-06-15T14:30:00"} | ${undefined}   | ${"one second"}
      ${"DDT"}        | ${"2024-06-16/2024-06-15T23:59"}             | ${undefined}   | ${"the end date-time is on the day before the start date"}
      ${"DTD"}        | ${"2024-06-16T00:00/2024-06-15"}             | ${undefined}   | ${"the end date is before the start date-time's date"}
    `(
      "returns the sentinel for $formatQualifier $value ($reads)",
      ({ formatQualifier, value, options }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier, options)).toBe(
          "",
        );
      },
    );

    // Every mask with a year has room for four digits at most.
    it.each`
      formatQualifier | value                               | reads
      ${"D8"}         | ${"+010000-01-01"}                  | ${"year 10000"}
      ${"D8"}         | ${"-000001-12-31"}                  | ${"year −1"}
      ${"DB"}         | ${"+010000-01-01"}                  | ${"year 10000"}
      ${"DT"}         | ${"+010000-01-01T00:00"}            | ${"year 10000"}
      ${"RTS"}        | ${"-000001-12-31T23:59:59"}         | ${"year −1"}
      ${"RD8"}        | ${"9999-12-31/+010000-01-01"}       | ${"an end in year 10000"}
      ${"RD8"}        | ${"-000001-12-31/0000-01-01"}       | ${"a start in year −1"}
      ${"DDT"}        | ${"9999-12-31/+010000-01-01T00:00"} | ${"an end in year 10000"}
      ${"TC"}         | ${"+010000-01-01"}                  | ${"year 10000: outside X12's years, though TC writes no year"}
      ${"EH"}         | ${"-000001-06-15"}                  | ${"year −1: its last digit is not a year digit"}
    `(
      "returns the sentinel for $formatQualifier $value ($reads)",
      ({ formatQualifier, value }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe("");
      },
    );

    it.each`
      formatQualifier | value                    | reads
      ${"D8"}         | ${"2023-02-29"}          | ${"29 February 2023"}
      ${"D8"}         | ${"2024-06-31"}          | ${"31 June"}
      ${"D8"}         | ${"2024-13-01"}          | ${"month 13"}
      ${"DT"}         | ${"2024-06-15T24:00"}    | ${"hour 24"}
      ${"RTS"}        | ${"2016-12-31T23:59:60"} | ${"a leap second"}
      ${"TS"}         | ${"23:59:60"}            | ${"a leap second"}
      ${"TM"}         | ${"14:60"}               | ${"minute 60"}
      ${"D8"}         | ${"not a date"}          | ${"garbage"}
      ${"D8"}         | ${""}                    | ${"an empty string"}
    `(
      "returns the sentinel for $formatQualifier '$value' ($reads)",
      ({ formatQualifier, value }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe("");
      },
    );
  });

  describe("RFC 9557 annotations are read as the plain validators read them", () => {
    // An ISO calendar, an elective unknown key and a zone on a plain value are read and ignored;
    // another calendar and a critical unknown key are refused. A zone annotation may hold a
    // solidus, which is not the interval's.
    it.each`
      formatQualifier | value                                                    | expected
      ${"D8"}         | ${"2024-06-15[u-ca=iso8601]"}                            | ${"20240615"}
      ${"D8"}         | ${"2024-06-15[foo=bar]"}                                 | ${"20240615"}
      ${"D8"}         | ${"2024-06-15[Europe/London]"}                           | ${"20240615"}
      ${"DT"}         | ${"2024-06-15T14:30[America/New_York]"}                  | ${"202406151430"}
      ${"RD8"}        | ${"2024-06-15[Europe/London]/2024-06-20[Europe/London]"} | ${"20240615-20240620"}
      ${"RD8"}        | ${"2024-06-15[u-ca=iso8601]/2024-06-20"}                 | ${"20240615-20240620"}
      ${"D8"}         | ${"2024-06-15[u-ca=hebrew]"}                             | ${""}
      ${"D8"}         | ${"2024-06-15[u-ca=gregory]"}                            | ${""}
      ${"D8"}         | ${"2024-06-15[!foo=bar]"}                                | ${""}
      ${"RD8"}        | ${"2024-06-15/2024-06-20[u-ca=hebrew]"}                  | ${""}
      ${"RD8"}        | ${"2024-06-15[Europe/London"}                            | ${""}
    `(
      "writes $formatQualifier $value as '$expected'",
      ({ formatQualifier, value, expected }) => {
        expect(formatX12DateTimePeriod(value, formatQualifier)).toBe(expected);
      },
    );
  });

  describe("UN (Unstructured) is never written", () => {
    it.each`
      value
      ${"2024-06-15"}
      ${"2024-06-15T14:30"}
      ${"14:30"}
      ${"2024-06-15/2024-06-20"}
      ${"15 June 2024"}
      ${""}
    `("returns the sentinel for UN '$value'", ({ value }) => {
      expect(formatX12DateTimePeriod(value, "UN")).toBe("");
      expect(formatX12DateTimePeriod(value, "UN", WINDOW_2000)).toBe("");
    });
  });

  describe("a code GMT does not write returns the sentinel", () => {
    it.each`
      formatQualifier | value                      | reads
      ${"CC"}         | ${"2024-06-15"}            | ${"a 1250 code for a century alone"}
      ${"CY"}         | ${"2024-06-15"}            | ${"a 1250 code for a year"}
      ${"CM"}         | ${"2024-06-15"}            | ${"a 1250 code for a year and month"}
      ${"YM"}         | ${"2024-06-15"}            | ${"a 1250 code for a year and month"}
      ${"MD"}         | ${"2024-06-15"}            | ${"a 1250 code for a month and day"}
      ${"CD"}         | ${"2024-06-15"}            | ${"a 1250 month-name form"}
      ${"KA"}         | ${"2024-06-15"}            | ${"a 1250 month-name form"}
      ${"YMM"}        | ${"2024-06-15"}            | ${"a 1250 month-name range"}
      ${"CQ"}         | ${"2024-06-15"}            | ${"a 1250 code for a year and quarter"}
      ${"MCY"}        | ${"2024-06-15"}            | ${"a 1250 code for a month and year"}
      ${"DD"}         | ${"2024-06-15"}            | ${"a 1250 code for a day of the month"}
      ${"MM"}         | ${"2024-06-15"}            | ${"a 1250 code for a month"}
      ${"TQ"}         | ${"2024-06-15"}            | ${"a 1250 code for a month and year"}
      ${"YY"}         | ${"2024-06-15"}            | ${"a 1250 code for a year"}
      ${"DA"}         | ${"2024-06-15/2024-06-20"} | ${"a 1250 range of days within a month"}
      ${"RD2"}        | ${"2024-06-15/2025-06-15"} | ${"a 1250 range of years"}
      ${"RD4"}        | ${"2024-06-15/2025-06-15"} | ${"a 1250 range of years"}
      ${"RD5"}        | ${"2024-06-15/2024-07-15"} | ${"a 1250 range of years and months"}
      ${"RDM"}        | ${"2024-06-15/2024-06-20"} | ${"YYMMDD-MMDD: the end names no year"}
      ${"RMD"}        | ${"2024-06-15/2024-06-20"} | ${"a 1250 range of months and days"}
      ${"RMY"}        | ${"2024-06-15/2024-07-15"} | ${"a 1250 range of years and months"}
      ${"ZZ"}         | ${"2024-06-15"}            | ${"an unknown code"}
      ${""}           | ${"2024-06-15"}            | ${"an empty code"}
      ${"d8"}         | ${"2024-06-15"}            | ${"lower case: matching is exact"}
      ${" D8"}        | ${"2024-06-15"}            | ${"a leading space"}
      ${"DTM"}        | ${"2024-06-15"}            | ${"a segment name, not a 1250 code"}
      ${"102"}        | ${"2024-06-15"}            | ${"a UN/EDIFACT 2379 code"}
      ${"toString"}   | ${"2024-06-15"}            | ${"an inherited property name"}
      ${"__proto__"}  | ${"2024-06-15"}            | ${"an inherited property name"}
    `(
      "returns the sentinel for $value under the format qualifier '$formatQualifier' ($reads)",
      ({ formatQualifier, value }) => {
        expect(
          formatX12DateTimePeriod(value, formatQualifier, WINDOW_2000),
        ).toBe("");
      },
    );
  });

  describe("the options argument is omitted, undefined or an Object", () => {
    // D8 never reads the bag, so the sentinel comes from the argument alone.
    it.each`
      make               | kind
      ${() => null}      | ${"null"}
      ${() => "rolling"} | ${"a string"}
      ${() => 2000}      | ${"a number, the window passed positionally"}
      ${() => true}      | ${"a boolean"}
    `(
      "returns the sentinel for D8 2024-06-15 with options that are $kind",
      ({ make }) => {
        expect(
          formatX12DateTimePeriod("2024-06-15", "D8", make() as never),
        ).toBe("");
      },
    );

    it.each`
      make                                                 | kind
      ${() => undefined}                                   | ${"undefined"}
      ${() => ({})}                                        | ${"an empty object"}
      ${() => Object.assign(() => undefined, WINDOW_2000)} | ${"a function carrying the option"}
    `("writes D8 2024-06-15 with options that are $kind", ({ make }) => {
      expect(formatX12DateTimePeriod("2024-06-15", "D8", make() as never)).toBe(
        "20240615",
      );
    });

    it("reads a function carrying yearWindow as the object", () => {
      expect(
        formatX12DateTimePeriod(
          "2024-06-15",
          "D6",
          Object.assign(() => undefined, WINDOW_2000),
        ),
      ).toBe("240615");
    });

    // A hostile bag is an Object. D6 reads yearWindow from it, which throws; D8 never reads it.
    it.each`
      make                                                                | kind
      ${() => hostileProxy()}                                             | ${"a Proxy that throws on any trap"}
      ${() => revokedProxy()}                                             | ${"a revoked Proxy"}
      ${() => Object.defineProperty({}, "yearWindow", { get: throwing })} | ${"an object whose yearWindow getter throws"}
    `(
      "returns the sentinel for D6 with options that are $kind, and writes D8 without touching them",
      ({ make }) => {
        expect(
          formatX12DateTimePeriod("2024-06-15", "D6", make() as never),
        ).toBe("");
        expect(
          formatX12DateTimePeriod("2024-06-15", "D8", make() as never),
        ).toBe("20240615");
      },
    );
  });

  // A non-string collapses to one path per argument. The number is the epoch milliseconds a
  // caller might pass. A range code splits its value before it reads it, so the value is tried
  // under a single-value code and a range code.
  it.each`
    argument                       | call
    ${"value under D8"}            | ${(bad: unknown) => formatX12DateTimePeriod(bad as never, "D8")}
    ${"value under the range RD8"} | ${(bad: unknown) => formatX12DateTimePeriod(bad as never, "RD8")}
    ${"formatQualifier"}           | ${(bad: unknown) => formatX12DateTimePeriod("2024-06-15", bad as never)}
  `("returns the sentinel for a $argument that is not a string", ({ call }) => {
    for (const [kind, make] of NON_STRINGS) {
      expect(call(make()), kind).toBe("");
    }
  });

  describe("never throws when Temporal does", () => {
    it("returns the sentinel for D8 when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(formatX12DateTimePeriod("2024-06-15", "D8")).toBe("");
    });

    it("returns the sentinel for DT when Temporal.PlainDateTime.from throws", () => {
      mockTemporalPlainDateTimeFromThrow();
      expect(formatX12DateTimePeriod("2024-06-15T14:30", "DT")).toBe("");
    });

    it("returns the sentinel for TM when Temporal.PlainTime.from throws", () => {
      mockTemporalPlainTimeFromThrow();
      expect(formatX12DateTimePeriod("14:30", "TM")).toBe("");
    });
  });
});
