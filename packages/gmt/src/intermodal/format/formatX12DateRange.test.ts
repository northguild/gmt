import { vi } from "vitest";
import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { parseX12DateRange } from "../parse/parseX12DateRange";
import { formatX12DateRange } from "./formatX12DateRange";

/**
 * Every expected value is the two ISO 8601 dates placed under the X12 1250 mask by hand: `RD8`
 * is `CCYYMMDD-CCYYMMDD` and `RD` is `MMDDCCYY-MMDDCCYY`, joined by one hyphen.
 */
describe("formatX12DateRange", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("RD8 CCYYMMDD-CCYYMMDD and RD MMDDCCYY-MMDDCCYY: a range between two dates, written with its hyphen", () => {
    it.each`
      code     | start           | end             | expected               | reads
      ${"RD8"} | ${"2024-06-15"} | ${"2024-06-20"} | ${"20240615-20240620"} | ${"five days, year first"}
      ${"RD8"} | ${"2024-06-15"} | ${"2024-06-15"} | ${"20240615-20240615"} | ${"one day: the end equals the start"}
      ${"RD8"} | ${"0000-01-01"} | ${"9999-12-31"} | ${"00000101-99991231"} | ${"the whole four-digit range"}
      ${"RD"}  | ${"2024-06-15"} | ${"2024-06-20"} | ${"06152024-06202024"} | ${"five days, month first"}
      ${"RD"}  | ${"2023-12-31"} | ${"2024-01-01"} | ${"12312023-01012024"} | ${"across a year end"}
      ${"RD"}  | ${"2024-02-28"} | ${"2024-02-29"} | ${"02282024-02292024"} | ${"into leap day 2024"}
    `(
      "writes $start to $end under $code as $expected ($reads), which reads back",
      ({ code, start, end, expected }) => {
        expect(formatX12DateRange(start, end, code)).toBe(expected);
        expect(parseX12DateRange(expected, code)).toEqual({ start, end });
      },
    );
  });

  describe("an end before its start names no span of time (GMT rule)", () => {
    it.each`
      code     | start           | end             | reads
      ${"RD8"} | ${"2024-06-20"} | ${"2024-06-15"} | ${"the end date is five days before the start"}
      ${"RD"}  | ${"2025-01-01"} | ${"2024-12-31"} | ${"the end is the day before the start"}
    `(
      "returns '' for $start to $end under $code ($reads)",
      ({ code, start, end }) => {
        expect(formatX12DateRange(start, end, code)).toBe("");
      },
    );
  });

  describe("each end is a date, as isValidDate accepts it", () => {
    it.each`
      start                      | end                   | reads
      ${"2024-06-15T14:30"}      | ${"2024-06-20"}       | ${"a date-time start: use formatX12DateTimeRange"}
      ${"2024-06-15"}            | ${"2024-06-20T16:00"} | ${"a date-time end: DDT, a date and a date-time, is not written"}
      ${"2024-06-15T14:30:00Z"}  | ${"2024-06-20"}       | ${"an instant start"}
      ${"2024-06-15/2024-06-20"} | ${"2024-06-20"}       | ${"an interval string is not a start"}
      ${"2024-06-15"}            | ${"P5D"}              | ${"a duration is not an end"}
      ${"2024-06-15"}            | ${"2023-02-29"}       | ${"an end that is not a real date"}
      ${"2024-06-15"}            | ${"+010000-01-01"}    | ${"an end in year 10000"}
      ${"09:00"}                 | ${"17:00"}            | ${"times: RTM, a range of times, is not written"}
      ${"2024-06-15"}            | ${""}                 | ${"an empty end"}
      ${""}                      | ${"2024-06-20"}       | ${"an empty start"}
    `("returns '' for $start to $end ($reads)", ({ start, end }) => {
      expect(formatX12DateRange(start, end, "RD8")).toBe("");
      expect(formatX12DateRange(start, end, "RD")).toBe("");
    });
  });

  describe("a code that does not state a range of dates", () => {
    it.each(x12FormatsOutside("dateRange"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(
          formatX12DateRange("2024-06-15", "2024-06-20", code as never),
        ).toBe("");
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"start"}  | ${(bad: unknown) => formatX12DateRange(bad as never, "2024-06-20", "RD8")}
      ${"end"}    | ${(bad: unknown) => formatX12DateRange("2024-06-15", bad as never, "RD8")}
      ${"format"} | ${(bad: unknown) => formatX12DateRange("2024-06-15", "2024-06-20", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(formatX12DateRange("2024-06-15", "2024-06-20", "RD8")).toBe("");
  });
});
