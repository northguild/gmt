import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { resolveLocal } from "../../instant/convert/resolveLocal";
import { toOffsetInstant } from "../../instant/convert/toOffsetInstant";
import { NON_STRINGS } from "../../test/ediCodes";
import {
  mockTemporalPlainDateFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { parseX12DateAndTime } from "./parseX12DateAndTime";
import { x12TimeCodeOffset } from "./x12TimeCodeOffset";

/**
 * Every expected value is read off the two elements by hand: data element 373 is `CCYYMMDD` and
 * data element 337 is `HHMM`, `HHMMSS`, `HHMMSSD` or `HHMMSSDD`. Together they are one local
 * date-time.
 */
describe("parseX12DateAndTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("elements 373 and 337, as AT7, G62 and DTM send them side by side", () => {
    it.each`
      date          | time          | expected                    | reads
      ${"20240615"} | ${"1430"}     | ${"2024-06-15T14:30:00"}    | ${"HHMM: seconds are written as 00"}
      ${"20240615"} | ${"143045"}   | ${"2024-06-15T14:30:45"}    | ${"HHMMSS"}
      ${"20240615"} | ${"1430001"}  | ${"2024-06-15T14:30:00.1"}  | ${"HHMMSSD: a tenth of a second"}
      ${"20240615"} | ${"14300012"} | ${"2024-06-15T14:30:00.12"} | ${"HHMMSSDD: hundredths of a second"}
      ${"20240615"} | ${"14304505"} | ${"2024-06-15T14:30:45.05"} | ${"five hundredths: the leading zero of DD counts"}
      ${"20240229"} | ${"2359599"}  | ${"2024-02-29T23:59:59.9"}  | ${"the last tenth of leap day 2024 keeps its date"}
      ${"20240615"} | ${"14300000"} | ${"2024-06-15T14:30:00"}    | ${"a zero fraction is not written"}
      ${"20240229"} | ${"0000"}     | ${"2024-02-29T00:00:00"}    | ${"midnight on leap day 2024"}
      ${"20241231"} | ${"2359"}     | ${"2024-12-31T23:59:00"}    | ${"the last minute of a year"}
      ${"00000101"} | ${"0000"}     | ${"0000-01-01T00:00:00"}    | ${"the first four-digit year"}
      ${"99991231"} | ${"23595999"} | ${"9999-12-31T23:59:59.99"} | ${"the last hundredth of the last four-digit year"}
    `(
      "reads $date and $time as $expected ($reads)",
      ({ date, time, expected }) => {
        expect(Temporal.PlainDateTime.from(expected).toString()).toBe(expected);
        expect(parseX12DateAndTime(date, time)).toBe(expected);
      },
    );

    // The common freight read: the local date-time, then the offset its time code states. Code
    // `20` is "Equivalent to ISO M05": 14:30 at −05:00 is 19:30Z. Code `24` is M01: 23:30 at
    // −01:00 is 00:30Z on the next UTC day.
    it.each`
      date          | time      | timeCode | instant                   | offset
      ${"20240615"} | ${"1430"} | ${"20"}  | ${"2024-06-15T19:30:00Z"} | ${"-05:00"}
      ${"20240615"} | ${"2330"} | ${"24"}  | ${"2024-06-16T00:30:00Z"} | ${"-01:00"}
      ${"20240615"} | ${"1430"} | ${"UT"}  | ${"2024-06-15T14:30:00Z"} | ${"+00:00"}
      ${"20240615"} | ${"1430"} | ${"27"}  | ${"2024-06-15T09:00:00Z"} | ${"+05:30"}
    `(
      "$date $time with time code $timeCode is the instant $instant at $offset",
      ({ date, time, timeCode, instant, offset }) => {
        const local = parseX12DateAndTime(date, time);
        expect(x12TimeCodeOffset(timeCode)).toBe(offset);
        expect(resolveLocal(local, x12TimeCodeOffset(timeCode))).toBe(instant);
        expect(
          toOffsetInstant(`${local}${x12TimeCodeOffset(timeCode)}`),
        ).toEqual({ instant, offset });
      },
    );
  });

  describe("both elements are required", () => {
    it.each`
      date          | time      | reads
      ${""}         | ${"1430"} | ${"no date: read the time alone with parseX12Time"}
      ${"20240615"} | ${""}     | ${"no time: read the date alone with parseX12Date"}
      ${""}         | ${""}     | ${"neither"}
    `("returns '' for '$date' and '$time' ($reads)", ({ date, time }) => {
      expect(parseX12DateAndTime(date, time)).toBe("");
    });

    it("returns '' when an argument is omitted", () => {
      const omitTime = parseX12DateAndTime as (date: string) => string;
      const omitBoth = parseX12DateAndTime as () => string;
      expect(omitTime("20240615")).toBe("");
      expect(omitBoth()).toBe("");
    });
  });

  describe("fields are checked, not clamped (TC39 overflow: reject)", () => {
    it.each`
      date            | time           | reads
      ${"20230229"}   | ${"1430"}      | ${"29 February 2023, not a leap year"}
      ${"20240631"}   | ${"1430"}      | ${"31 June"}
      ${"20240615"}   | ${"2430"}      | ${"hour 24"}
      ${"20240615"}   | ${"1460"}      | ${"minute 60"}
      ${"20240615"}   | ${"143060"}    | ${"second 60: GMT rejects a leap second"}
      ${"20240615"}   | ${"14304"}     | ${"five digits is not an element 337 form"}
      ${"20240615"}   | ${"143045123"} | ${"nine digits"}
      ${"240615"}     | ${"1430"}      | ${"a two-digit year: element 373 is CCYYMMDD"}
      ${"06152024"}   | ${"1430"}      | ${"month first: element 373 is CCYYMMDD"}
      ${"2024-06-15"} | ${"14:30"}     | ${"ISO 8601: the values are the digits of the elements"}
      ${"20240615"}   | ${"1430ET"}    | ${"a time code is its own element"}
    `("returns '' for $date and $time ($reads)", ({ date, time }) => {
      expect(parseX12DateAndTime(date, time)).toBe("");
    });
  });

  describe("non-string arguments", () => {
    it.each`
      argument  | call
      ${"date"} | ${(bad: unknown) => parseX12DateAndTime(bad as never, "1430")}
      ${"time"} | ${(bad: unknown) => parseX12DateAndTime("20240615", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  describe("the catch path", () => {
    it("returns '' when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(parseX12DateAndTime("20240615", "1430")).toBe("");
    });

    it("returns '' when Temporal.PlainTime.from throws", () => {
      mockTemporalPlainTimeFromThrow();
      expect(parseX12DateAndTime("20240615", "1430")).toBe("");
    });
  });
});
