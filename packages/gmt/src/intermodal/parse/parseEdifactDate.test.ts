import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseDateWithPattern } from "../../plain/parse/parseDateWithPattern";
import { parseEdifactDate } from "./parseEdifactDate";

/**
 * Every expected value is read off the UNTDID 2379 mask by hand: `102` is `CCYYMMDD`, so the
 * first four digits are the year, the next two the month and the last two the day. The
 * digit-level grammar of the mask is asserted in `internal/ediGrammar.test.ts`.
 */
describe("parseEdifactDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("102 CCYYMMDD: a calendar date", () => {
    it.each`
      value         | expected        | reads
      ${"20240615"} | ${"2024-06-15"} | ${"15 June 2024"}
      ${"20240229"} | ${"2024-02-29"} | ${"leap day 2024"}
      ${"20231231"} | ${"2023-12-31"} | ${"the last day of a year"}
      ${"00000101"} | ${"0000-01-01"} | ${"the first four-digit year"}
      ${"00000229"} | ${"0000-02-29"} | ${"year 0000 is a leap year: divisible by 400"}
      ${"99991231"} | ${"9999-12-31"} | ${"the last four-digit year"}
    `("reads $value as $expected ($reads)", ({ value, expected }) => {
      expect(
        Temporal.PlainDate.from(expected, { overflow: "reject" }).toString(),
      ).toBe(expected);
      expect(parseEdifactDate(value, "102")).toBe(expected);
    });

    it("reads the mask exactly: not one digit short or long", () => {
      expect(parseEdifactDate("2024061", "102")).toBe("");
      expect(parseEdifactDate("202406150", "102")).toBe("");
    });
  });

  describe("fields are checked, not clamped (TC39 overflow: reject)", () => {
    it.each`
      value                 | reads
      ${"20230229"}         | ${"29 February 2023, not a leap year"}
      ${"20240631"}         | ${"31 June"}
      ${"20241301"}         | ${"month 13"}
      ${"20240600"}         | ${"day 00"}
      ${"2024-06-15"}       | ${"an ISO 8601 date: the value is the digits of the mask"}
      ${"240615"}           | ${"YYMMDD: a two-digit year is not read"}
      ${" 20240615"}        | ${"a leading space"}
      ${"20240615\n"}       | ${"a trailing newline"}
      ${"２０２４０６１５"} | ${"full-width digits"}
      ${"not a date"}       | ${"garbage"}
      ${""}                 | ${"an empty value"}
    `("returns '' for $value ($reads)", ({ value }) => {
      expect(parseEdifactDate(value, "102")).toBe("");
    });
  });

  describe("a code that does not state a date", () => {
    // Each value fits a date mask (or the code's own), so the sentinel is for the code.
    it.each(edifactFormatsOutside("date"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(parseEdifactDate("20240615", code as never)).toBe("");
        expect(parseEdifactDate("240615", code as never)).toBe("");
        expect(parseEdifactDate("202406151430", code as never)).toBe("");
      },
    );

    // The documented way to read a two-digit year: the pattern parser, with the century stated.
    it("a 101 value (YYMMDD) is read by parseDateWithPattern with a yy pattern and a yearWindow", () => {
      expect(parseEdifactDate("240615", "101" as never)).toBe("");
      expect(
        parseDateWithPattern("240615", "yyMMdd", undefined, {
          yearWindow: 2000,
        }),
      ).toBe("2024-06-15");
    });
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => parseEdifactDate(bad as never, "102")}
      ${"format"} | ${(bad: unknown) => parseEdifactDate("20240615", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(parseEdifactDate("20240615", "102")).toBe("");
  });
});
