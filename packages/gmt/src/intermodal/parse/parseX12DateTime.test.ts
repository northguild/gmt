import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { NON_STRINGS, x12FormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseDateTimeWithPattern } from "../../plain/parse/parseDateTimeWithPattern";
import { parseX12DateTime } from "./parseX12DateTime";

/**
 * Every expected value is read off the X12 data element 1250 mask by hand: `DT` is
 * `CCYYMMDDHHMM` and `RTS` is `CCYYMMDDHHMMSS`. The result is the wall clock as written; no
 * 1250 code carries an offset.
 */
describe("parseX12DateTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("DT CCYYMMDDHHMM and RTS CCYYMMDDHHMMSS: a date and time with no offset", () => {
    it.each`
      code     | value               | expected                 | reads
      ${"DT"}  | ${"202406151430"}   | ${"2024-06-15T14:30:00"} | ${"seconds are written as 00"}
      ${"DT"}  | ${"202406150000"}   | ${"2024-06-15T00:00:00"} | ${"midnight"}
      ${"DT"}  | ${"202402292359"}   | ${"2024-02-29T23:59:00"} | ${"the last minute of leap day 2024"}
      ${"DT"}  | ${"000001010000"}   | ${"0000-01-01T00:00:00"} | ${"the first minute of the first four-digit year"}
      ${"DT"}  | ${"999912312359"}   | ${"9999-12-31T23:59:00"} | ${"the last minute of the last four-digit year"}
      ${"RTS"} | ${"20240615143045"} | ${"2024-06-15T14:30:45"} | ${"with seconds: one date-time despite the R"}
      ${"RTS"} | ${"20240615143000"} | ${"2024-06-15T14:30:00"} | ${"zero seconds"}
      ${"RTS"} | ${"99991231235959"} | ${"9999-12-31T23:59:59"} | ${"the last second of the last four-digit year"}
    `(
      "reads $code $value as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(Temporal.PlainDateTime.from(expected).toString()).toBe(expected);
        expect(parseX12DateTime(value, code)).toBe(expected);
      },
    );

    it.each`
      code     | value                | reads
      ${"DT"}  | ${"20240615143045"}  | ${"RTS's value under DT"}
      ${"RTS"} | ${"202406151430"}    | ${"DT's value under RTS"}
      ${"DT"}  | ${"20240615143"}     | ${"one digit short"}
      ${"RTS"} | ${"202406151430450"} | ${"one digit long"}
    `("returns '' for $code $value ($reads)", ({ code, value }) => {
      expect(parseX12DateTime(value, code)).toBe("");
    });
  });

  describe("fields are checked, not clamped (TC39 overflow: reject)", () => {
    it.each`
      code     | value                 | reads
      ${"DT"}  | ${"202302291430"}     | ${"29 February 2023, not a leap year"}
      ${"DT"}  | ${"202406311430"}     | ${"31 June"}
      ${"DT"}  | ${"202406152430"}     | ${"hour 24"}
      ${"DT"}  | ${"202406151460"}     | ${"minute 60"}
      ${"RTS"} | ${"20240615143060"}   | ${"second 60: GMT rejects a leap second"}
      ${"DT"}  | ${"2024-06-15T14:30"} | ${"an ISO 8601 date-time: the value is the digits of the mask"}
      ${"DT"}  | ${"1506241430"}       | ${"DDMMYYHHMM: a two-digit year is not read"}
      ${"DT"}  | ${"202406151430ET"}   | ${"a time code is its own element"}
      ${"DT"}  | ${""}                 | ${"an empty value"}
    `("returns '' for $code $value ($reads)", ({ code, value }) => {
      expect(parseX12DateTime(value, code)).toBe("");
    });
  });

  describe("a code that does not state a local date-time", () => {
    it.each(x12FormatsOutside("dateTime"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(parseX12DateTime("202406151430", code as never)).toBe("");
        expect(parseX12DateTime("1506241430", code as never)).toBe("");
        expect(parseX12DateTime("20240615", code as never)).toBe("");
      },
    );

    // The documented way to read a two-digit year: the pattern parser, with the century stated.
    it("a TR value (DDMMYYHHMM) is read by parseDateTimeWithPattern with a yy pattern and a yearWindow", () => {
      expect(parseX12DateTime("1506241430", "TR" as never)).toBe("");
      expect(
        parseDateTimeWithPattern("1506241430", "ddMMyyHHmm", undefined, {
          yearWindow: 2000,
        }),
      ).toBe("2024-06-15T14:30:00");
    });
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => parseX12DateTime(bad as never, "DT")}
      ${"format"} | ${(bad: unknown) => parseX12DateTime("202406151430", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(parseX12DateTime("202406151430", "DT")).toBe("");
  });
});
