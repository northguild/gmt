import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseDateWithPattern } from "../../plain/parse/parseDateWithPattern";
import { parseX12Date } from "./parseX12Date";

/**
 * Every expected value is read off the X12 data element 1250 mask by hand: `D8` is `CCYYMMDD`
 * (year, month, day) and `DB` is `MMDDCCYY` (month, day, year).
 */
describe("parseX12Date", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("D8 CCYYMMDD and DB MMDDCCYY: a calendar date", () => {
    it.each`
      code    | value         | expected        | reads
      ${"D8"} | ${"20240615"} | ${"2024-06-15"} | ${"15 June 2024, year first"}
      ${"D8"} | ${"20240229"} | ${"2024-02-29"} | ${"leap day 2024"}
      ${"D8"} | ${"00000101"} | ${"0000-01-01"} | ${"the first four-digit year"}
      ${"D8"} | ${"99991231"} | ${"9999-12-31"} | ${"the last four-digit year"}
      ${"DB"} | ${"06152024"} | ${"2024-06-15"} | ${"15 June 2024, month first"}
      ${"DB"} | ${"02292024"} | ${"2024-02-29"} | ${"leap day 2024"}
      ${"DB"} | ${"01010000"} | ${"0000-01-01"} | ${"the first four-digit year"}
      ${"DB"} | ${"12319999"} | ${"9999-12-31"} | ${"the last four-digit year"}
    `(
      "reads $code $value as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(
          Temporal.PlainDate.from(expected, { overflow: "reject" }).toString(),
        ).toBe(expected);
        expect(parseX12Date(value, code)).toBe(expected);
      },
    );

    // One run of eight digits reads two ways, so the code is what tells the orders apart:
    // 10 October 1010 is the same digits under both, 11 December 1020 under D8 is 20 October
    // 1211 under DB, and a run whose third and fourth (or first and second) digits are no month
    // reads under one code only.
    it.each`
      value         | asD8            | asDB
      ${"10101010"} | ${"1010-10-10"} | ${"1010-10-10"}
      ${"20101112"} | ${"2010-11-12"} | ${""}
      ${"12112010"} | ${""}           | ${"2010-12-11"}
      ${"10201211"} | ${"1020-12-11"} | ${"1211-10-20"}
    `(
      "reads $value as '$asD8' under D8 and as '$asDB' under DB",
      ({ value, asD8, asDB }) => {
        expect(parseX12Date(value, "D8")).toBe(asD8);
        expect(parseX12Date(value, "DB")).toBe(asDB);
      },
    );
  });

  describe("fields are checked, not clamped (TC39 overflow: reject)", () => {
    it.each`
      code    | value           | reads
      ${"D8"} | ${"20230229"}   | ${"29 February 2023, not a leap year"}
      ${"D8"} | ${"20240631"}   | ${"31 June"}
      ${"D8"} | ${"20241301"}   | ${"month 13"}
      ${"DB"} | ${"02292023"}   | ${"29 February 2023, month first"}
      ${"DB"} | ${"06312024"}   | ${"31 June, month first"}
      ${"DB"} | ${"13012024"}   | ${"month 13"}
      ${"D8"} | ${"2024-06-15"} | ${"an ISO 8601 date: the value is the digits of the mask"}
      ${"DB"} | ${"06/15/2024"} | ${"separators"}
      ${"D8"} | ${"240615"}     | ${"YYMMDD: a two-digit year is not read"}
      ${"DB"} | ${"061524"}     | ${"MMDDYY: a two-digit year is not read"}
      ${"D8"} | ${"2024061"}    | ${"one digit short"}
      ${"D8"} | ${"202406150"}  | ${"one digit long"}
      ${"D8"} | ${" 20240615"}  | ${"a leading space"}
      ${"D8"} | ${""}           | ${"an empty value"}
    `("returns '' for $code $value ($reads)", ({ code, value }) => {
      expect(parseX12Date(value, code)).toBe("");
    });
  });

  describe("a code that does not state a date", () => {
    it.each(x12FormatsOutside("date"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(parseX12Date("20240615", code as never)).toBe("");
        expect(parseX12Date("240615", code as never)).toBe("");
        expect(parseX12Date("061524", code as never)).toBe("");
      },
    );

    // The documented way to read a two-digit year: the pattern parser, with the century stated.
    it("a D6 value (YYMMDD) and a TT value (MMDDYY) are read by parseDateWithPattern with a yy pattern and a yearWindow", () => {
      expect(parseX12Date("240615", "D6" as never)).toBe("");
      expect(
        parseDateWithPattern("240615", "yyMMdd", undefined, {
          yearWindow: 2000,
        }),
      ).toBe("2024-06-15");
      expect(
        parseDateWithPattern("061524", "MMddyy", undefined, {
          yearWindow: 2000,
        }),
      ).toBe("2024-06-15");
    });
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => parseX12Date(bad as never, "D8")}
      ${"format"} | ${(bad: unknown) => parseX12Date("20240615", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(parseX12Date("20240615", "D8")).toBe("");
  });
});
