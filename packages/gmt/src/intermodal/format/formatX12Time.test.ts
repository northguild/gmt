import { vi } from "vitest";
import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseX12Time } from "../parse/parseX12Time";
import { formatX12Time } from "./formatX12Time";
import { formatX12TimeElement } from "./formatX12TimeElement";

/**
 * Every expected value is the ISO 8601 time placed under the X12 1250 mask by hand: `TM` is
 * `HHMM` and `TS` is `HHMMSS`. What the mask has no field for is left out, never rounded.
 */
describe("formatX12Time", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("TM HHMM and TS HHMMSS: a time of day", () => {
    // `readsBack` is the time cut to the mask's smallest field, which `parseX12Time` returns.
    it.each`
      code    | value                   | expected    | readsBack     | reads
      ${"TM"} | ${"14:30"}              | ${"1430"}   | ${"14:30:00"} | ${"hours and minutes"}
      ${"TM"} | ${"14:30:00"}           | ${"1430"}   | ${"14:30:00"} | ${"zero seconds"}
      ${"TM"} | ${"14:30:45"}           | ${"1430"}   | ${"14:30:00"} | ${"seconds are dropped: the mask has none"}
      ${"TM"} | ${"14:30:45.123"}       | ${"1430"}   | ${"14:30:00"} | ${"seconds and a fraction are dropped"}
      ${"TM"} | ${"14:30:59.999999999"} | ${"1430"}   | ${"14:30:00"} | ${"the last nanosecond of the minute is still that minute"}
      ${"TM"} | ${"23:59:59.999"}       | ${"2359"}   | ${"23:59:00"} | ${"the last millisecond of the day stays in minute 59: never 0000"}
      ${"TM"} | ${"00:00"}              | ${"0000"}   | ${"00:00:00"} | ${"midnight"}
      ${"TS"} | ${"14:30:45"}           | ${"143045"} | ${"14:30:45"} | ${"with seconds"}
      ${"TS"} | ${"14:30"}              | ${"143000"} | ${"14:30:00"} | ${"no seconds given: written as 00"}
      ${"TS"} | ${"14:30:45.123"}       | ${"143045"} | ${"14:30:45"} | ${"a fraction of a second is dropped"}
      ${"TS"} | ${"14:30:45.9"}         | ${"143045"} | ${"14:30:45"} | ${"0.9 of a second is dropped, not rounded up"}
      ${"TS"} | ${"23:59:59.999999999"} | ${"235959"} | ${"23:59:59"} | ${"the last nanosecond of the day"}
    `(
      "writes $value under $code as $expected, which reads back as $readsBack ($reads)",
      ({ code, value, expected, readsBack }) => {
        expect(formatX12Time(value, code)).toBe(expected);
        expect(parseX12Time(expected, code)).toBe(readsBack);
        expect(parseX12Time(expected)).toBe(readsBack);
      },
    );

    // Element 337 can hold tenths and hundredths, which no 1250 code has. `TS` is `HHMMSS`, so
    // this function cuts them; `formatX12TimeElement` writes them under the element's own masks.
    it("TS has no decimal seconds: a time read from 14300012 is written 143000 under TS, and 14300012 by formatX12TimeElement under HHMMSSDD", () => {
      expect(parseX12Time("14300012")).toBe("14:30:00.12");
      expect(formatX12Time("14:30:00.12", "TS")).toBe("143000");
      expect(formatX12TimeElement("14:30:00.12", "HHMMSSDD")).toBe("14300012");
    });
  });

  describe("the value is a time, as isValidTime accepts it", () => {
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
      ${"09:00/17:00"}         | ${"a range of times"}
      ${""}                    | ${"an empty value"}
    `("returns '' for $value ($reads)", ({ value }) => {
      expect(formatX12Time(value, "TM")).toBe("");
      expect(formatX12Time(value, "TS")).toBe("");
    });
  });

  describe("a code that does not state a time", () => {
    it.each(x12FormatsOutside("time"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(formatX12Time("14:30:45", code as never)).toBe("");
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => formatX12Time(bad as never, "TM")}
      ${"format"} | ${(bad: unknown) => formatX12Time("14:30", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(formatX12Time("14:30", "TM")).toBe("");
  });
});
