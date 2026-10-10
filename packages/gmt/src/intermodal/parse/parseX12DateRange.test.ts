import { expectTypeOf, vi } from "vitest";
import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { intervalLengthDate } from "../../plain/interval/intervalLengthDate";
import type { EdiDatePeriod } from "../../types/edi";
import { parseX12DateRange } from "./parseX12DateRange";

/**
 * Every expected value is read off the X12 data element 1250 mask by hand: `RD8` is
 * `CCYYMMDD-CCYYMMDD` and `RD` is `MMDDCCYY-MMDDCCYY`, two dates joined by the one hyphen X12
 * transmits.
 */
describe("parseX12DateRange", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("RD8 CCYYMMDD-CCYYMMDD and RD MMDDCCYY-MMDDCCYY: a range between two dates", () => {
    it.each`
      code     | value                  | expected                                      | reads
      ${"RD8"} | ${"20240615-20240620"} | ${{ start: "2024-06-15", end: "2024-06-20" }} | ${"five days, year first"}
      ${"RD8"} | ${"20240615-20240615"} | ${{ start: "2024-06-15", end: "2024-06-15" }} | ${"one day: the end equals the start"}
      ${"RD8"} | ${"20231231-20240101"} | ${{ start: "2023-12-31", end: "2024-01-01" }} | ${"across a year end"}
      ${"RD8"} | ${"00000101-99991231"} | ${{ start: "0000-01-01", end: "9999-12-31" }} | ${"the whole four-digit range"}
      ${"RD"}  | ${"06152024-06202024"} | ${{ start: "2024-06-15", end: "2024-06-20" }} | ${"five days, month first"}
      ${"RD"}  | ${"12312023-01012024"} | ${{ start: "2023-12-31", end: "2024-01-01" }} | ${"across a year end: the end's digits sort before the start's"}
      ${"RD"}  | ${"02282024-02292024"} | ${{ start: "2024-02-28", end: "2024-02-29" }} | ${"into leap day 2024"}
    `(
      "reads $code $value as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(parseX12DateRange(value, code)).toEqual(expected);
      },
    );

    it("returns exactly the members start and end", () => {
      expect(
        Object.keys(parseX12DateRange("20240615-20240620", "RD8") ?? {}),
      ).toEqual(["start", "end"]);
    });

    // X12 1250: "Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD". Each range definition
    // gives the format with its hyphen and carries no instruction to omit it.
    it.each`
      code     | value                   | reads
      ${"RD8"} | ${"2024061520240620"}   | ${"no hyphen: UN/EDIFACT 718's wire form, never an X12 one"}
      ${"RD8"} | ${"20240615--20240620"} | ${"two hyphens"}
      ${"RD8"} | ${"20240615/20240620"}  | ${"a solidus"}
      ${"RD8"} | ${"20240615 20240620"}  | ${"a space"}
      ${"RD8"} | ${"20240615"}           | ${"one date: D8's value"}
      ${"RD8"} | ${"240615-240620"}      | ${"YYMMDD-YYMMDD: a two-digit year is not read"}
      ${"RD8"} | ${"06152024-06202024"}  | ${"RD's order under RD8: 20 is not a month"}
      ${"RD"}  | ${"20240615-20240620"}  | ${"RD8's order under RD"}
      ${"RD"}  | ${"0615202406202024"}   | ${"no hyphen"}
      ${"RD8"} | ${""}                   | ${"an empty value"}
    `("returns null for $code $value ($reads)", ({ code, value }) => {
      expect(parseX12DateRange(value, code)).toBeNull();
    });
  });

  describe("the result is two plain values, not a pair of instants", () => {
    it("is typed EdiDatePeriod, with both members always present", () => {
      expectTypeOf(
        parseX12DateRange,
      ).returns.toEqualTypeOf<EdiDatePeriod | null>();
      expectTypeOf<EdiDatePeriod>().toEqualTypeOf<{
        start: string;
        end: string;
      }>();
    });

    // 15 to 20 June is five days.
    it("passes to the plain interval functions as (start, end)", () => {
      const period = parseX12DateRange("20240615-20240620", "RD8");
      expect(
        period === null
          ? null
          : intervalLengthDate(period.start, period.end, "day"),
      ).toBe(5);
    });
  });

  describe("an end before its start names no span of time (GMT rule)", () => {
    it.each`
      code     | value                  | reads
      ${"RD8"} | ${"20240620-20240615"} | ${"the end date is five days before the start"}
      ${"RD"}  | ${"06202024-06152024"} | ${"month first"}
      ${"RD"}  | ${"01012025-12312024"} | ${"the end is the day before the start, although its digits sort after"}
    `(
      "returns null for the reversed $code $value ($reads)",
      ({ code, value }) => {
        expect(parseX12DateRange(value, code)).toBeNull();
      },
    );
  });

  describe("fields are checked, not clamped (TC39 overflow: reject)", () => {
    it.each`
      code     | value                  | reads
      ${"RD8"} | ${"20230229-20240620"} | ${"29 February 2023 in the start"}
      ${"RD8"} | ${"20240615-20240631"} | ${"31 June in the end"}
      ${"RD"}  | ${"02292023-06202024"} | ${"29 February 2023, month first"}
      ${"RD8"} | ${"20241315-20240620"} | ${"month 13 in the start"}
    `("returns null for $code $value ($reads)", ({ code, value }) => {
      expect(parseX12DateRange(value, code)).toBeNull();
    });
  });

  describe("a code that does not state a range of dates", () => {
    it.each(x12FormatsOutside("dateRange"))(
      "returns null for code '$code' ($reads)",
      ({ code }) => {
        expect(
          parseX12DateRange("20240615-20240620", code as never),
        ).toBeNull();
        expect(parseX12DateRange("240615-240620", code as never)).toBeNull();
        expect(parseX12DateRange("20240615", code as never)).toBeNull();
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => parseX12DateRange(bad as never, "RD8")}
      ${"format"} | ${(bad: unknown) => parseX12DateRange("20240615-20240620", bad as never)}
    `("returns null for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBeNull();
      }
    });
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(parseX12DateRange("20240615-20240620", "RD8")).toBeNull();
  });
});
