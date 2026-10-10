import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseEdifactTime } from "./parseEdifactTime";

/**
 * Every expected value is read off the UNTDID 2379 mask by hand: `401` is `HHMM` and `402` is
 * `HHMMSS`. Seconds are always written in the result, `00` for the mask without them.
 */
describe("parseEdifactTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("401 HHMM and 402 HHMMSS: a time of day", () => {
    it.each`
      code     | value       | expected      | reads
      ${"401"} | ${"1430"}   | ${"14:30:00"} | ${"half past two: seconds are written as 00"}
      ${"401"} | ${"0000"}   | ${"00:00:00"} | ${"midnight"}
      ${"401"} | ${"2359"}   | ${"23:59:00"} | ${"the last minute of the day"}
      ${"401"} | ${"0905"}   | ${"09:05:00"} | ${"an hour and a minute below ten"}
      ${"402"} | ${"143045"} | ${"14:30:45"} | ${"with seconds"}
      ${"402"} | ${"143000"} | ${"14:30:00"} | ${"zero seconds"}
      ${"402"} | ${"000000"} | ${"00:00:00"} | ${"midnight"}
      ${"402"} | ${"235959"} | ${"23:59:59"} | ${"the last second of the day"}
    `(
      "reads $code $value as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(Temporal.PlainTime.from(expected).toString()).toBe(expected);
        expect(parseEdifactTime(value, code)).toBe(expected);
      },
    );

    // One run of digits fits one mask only: the code tells HHMM from HHMMSS.
    it.each`
      code     | value        | reads
      ${"401"} | ${"143045"}  | ${"402's value under 401"}
      ${"402"} | ${"1430"}    | ${"401's value under 402"}
      ${"401"} | ${"143"}     | ${"one digit short"}
      ${"401"} | ${"14300"}   | ${"one digit long"}
      ${"402"} | ${"14304"}   | ${"one digit short"}
      ${"402"} | ${"1430450"} | ${"one digit long"}
    `("returns '' for $code $value ($reads)", ({ code, value }) => {
      expect(parseEdifactTime(value, code)).toBe("");
    });
  });

  describe("fields are checked, not clamped (TC39 overflow: reject)", () => {
    it.each`
      code     | value          | reads
      ${"401"} | ${"2400"}      | ${"hour 24"}
      ${"401"} | ${"1460"}      | ${"minute 60"}
      ${"402"} | ${"143060"}    | ${"second 60: GMT rejects a leap second"}
      ${"401"} | ${"14:30"}     | ${"a colon: the value is the digits of the mask"}
      ${"401"} | ${"930"}       | ${"an unpadded hour"}
      ${"401"} | ${" 1430"}     | ${"a leading space"}
      ${"402"} | ${"143045+02"} | ${"404's value: a time with a zone is not read"}
      ${"401"} | ${""}          | ${"an empty value"}
    `("returns '' for $code $value ($reads)", ({ code, value }) => {
      expect(parseEdifactTime(value, code)).toBe("");
    });
  });

  describe("a code that does not state a time", () => {
    it.each(edifactFormatsOutside("time"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(parseEdifactTime("1430", code as never)).toBe("");
        expect(parseEdifactTime("143045", code as never)).toBe("");
        expect(parseEdifactTime("143045+02", code as never)).toBe("");
      },
    );
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => parseEdifactTime(bad as never, "401")}
      ${"format"} | ${(bad: unknown) => parseEdifactTime("1430", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(parseEdifactTime("1430", "401")).toBe("");
  });
});
