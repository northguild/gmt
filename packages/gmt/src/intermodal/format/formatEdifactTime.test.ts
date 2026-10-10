import { vi } from "vitest";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseEdifactTime } from "../parse/parseEdifactTime";
import { formatEdifactTime } from "./formatEdifactTime";

/**
 * Every expected value is the ISO 8601 time placed under the UNTDID 2379 mask by hand: `401` is
 * `HHMM` and `402` is `HHMMSS`. What the mask has no field for is left out, never rounded.
 */
describe("formatEdifactTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("401 HHMM and 402 HHMMSS: a time of day", () => {
    // `readsBack` is the time cut to the mask's smallest field, which is what the wire value
    // states: the parser returns it.
    it.each`
      code     | value                   | expected    | readsBack     | reads
      ${"401"} | ${"14:30"}              | ${"1430"}   | ${"14:30:00"} | ${"hours and minutes"}
      ${"401"} | ${"14:30:00"}           | ${"1430"}   | ${"14:30:00"} | ${"zero seconds"}
      ${"401"} | ${"14:30:45"}           | ${"1430"}   | ${"14:30:00"} | ${"seconds are dropped: the mask has none"}
      ${"401"} | ${"14:30:59.999999999"} | ${"1430"}   | ${"14:30:00"} | ${"the last nanosecond of the minute is still that minute"}
      ${"401"} | ${"23:59:59.999"}       | ${"2359"}   | ${"23:59:00"} | ${"the last millisecond of the day stays in minute 59: never 0000"}
      ${"401"} | ${"00:00"}              | ${"0000"}   | ${"00:00:00"} | ${"midnight"}
      ${"401"} | ${"09:05"}              | ${"0905"}   | ${"09:05:00"} | ${"fields below ten are zero-padded"}
      ${"402"} | ${"14:30:45"}           | ${"143045"} | ${"14:30:45"} | ${"with seconds"}
      ${"402"} | ${"14:30"}              | ${"143000"} | ${"14:30:00"} | ${"no seconds given: written as 00"}
      ${"402"} | ${"14:30:45.123"}       | ${"143045"} | ${"14:30:45"} | ${"a fraction of a second is dropped"}
      ${"402"} | ${"14:30:45.9"}         | ${"143045"} | ${"14:30:45"} | ${"0.9 of a second is dropped, not rounded up"}
      ${"402"} | ${"23:59:59.999999999"} | ${"235959"} | ${"23:59:59"} | ${"the last nanosecond of the day"}
    `(
      "writes $value under $code as $expected, which reads back as $readsBack ($reads)",
      ({ code, value, expected, readsBack }) => {
        expect(formatEdifactTime(value, code)).toBe(expected);
        expect(parseEdifactTime(expected, code)).toBe(readsBack);
      },
    );
  });

  describe("the value is a time, as isValidTime accepts it", () => {
    it.each`
      value                    | reads
      ${"2024-06-15T14:30:00"} | ${"a date-time"}
      ${"2024-06-15"}          | ${"a date"}
      ${"14:30:00+02:00"}      | ${"a time with an offset: no code that is read holds one"}
      ${"14:30:00Z"}           | ${"a time with a UTC designator"}
      ${"T14:30"}              | ${"a leading time designator"}
      ${"1430"}                | ${"basic format: the input is extended ISO 8601"}
      ${"24:00"}               | ${"hour 24"}
      ${"14:60"}               | ${"minute 60"}
      ${"23:59:60"}            | ${"a leap second"}
      ${"14"}                  | ${"an hour alone"}
      ${""}                    | ${"an empty value"}
    `("returns '' for $value ($reads)", ({ value }) => {
      expect(formatEdifactTime(value, "401")).toBe("");
      expect(formatEdifactTime(value, "402")).toBe("");
    });
  });

  describe("a code that does not state a time", () => {
    it.each(edifactFormatsOutside("time"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(formatEdifactTime("14:30:45", code as never)).toBe("");
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => formatEdifactTime(bad as never, "401")}
      ${"format"} | ${(bad: unknown) => formatEdifactTime("14:30", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(formatEdifactTime("14:30", "401")).toBe("");
  });
});
