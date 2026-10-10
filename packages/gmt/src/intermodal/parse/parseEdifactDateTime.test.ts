import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { NON_STRINGS, edifactFormatsOutside } from "../../test/ediCodes";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseDateTimeWithPattern } from "../../plain/parse/parseDateTimeWithPattern";
import { parseEdifactDateTime } from "./parseEdifactDateTime";

/**
 * Every expected value is read off the UNTDID 2379 mask by hand: `203` is `CCYYMMDDHHMM` and
 * `204` is `CCYYMMDDHHMMSS`. The result is the wall clock as written; it names no offset.
 */
describe("parseEdifactDateTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("203 CCYYMMDDHHMM and 204 CCYYMMDDHHMMSS: a date and time with no offset", () => {
    it.each`
      code     | value               | expected                 | reads
      ${"203"} | ${"202406151430"}   | ${"2024-06-15T14:30:00"} | ${"seconds are written as 00"}
      ${"203"} | ${"202406150000"}   | ${"2024-06-15T00:00:00"} | ${"midnight"}
      ${"203"} | ${"202406152359"}   | ${"2024-06-15T23:59:00"} | ${"the last minute"}
      ${"203"} | ${"202402291200"}   | ${"2024-02-29T12:00:00"} | ${"leap day 2024"}
      ${"203"} | ${"000001010000"}   | ${"0000-01-01T00:00:00"} | ${"the first minute of the first four-digit year"}
      ${"203"} | ${"999912312359"}   | ${"9999-12-31T23:59:00"} | ${"the last minute of the last four-digit year"}
      ${"204"} | ${"20240615143045"} | ${"2024-06-15T14:30:45"} | ${"with seconds"}
      ${"204"} | ${"20240615143000"} | ${"2024-06-15T14:30:00"} | ${"zero seconds"}
      ${"204"} | ${"99991231235959"} | ${"9999-12-31T23:59:59"} | ${"the last second of the last four-digit year"}
    `(
      "reads $code $value as $expected ($reads)",
      ({ code, value, expected }) => {
        expect(Temporal.PlainDateTime.from(expected).toString()).toBe(expected);
        expect(parseEdifactDateTime(value, code)).toBe(expected);
      },
    );

    // Two masks read one run of digits two ways, so the code is what tells them apart.
    it.each`
      code     | value               | reads
      ${"203"} | ${"20240615143045"} | ${"204's value under 203"}
      ${"204"} | ${"202406151430"}   | ${"203's value under 204"}
      ${"203"} | ${"20240615143"}    | ${"one digit short"}
      ${"203"} | ${"2024061514300"}  | ${"one digit long"}
    `("returns '' for $code $value ($reads)", ({ code, value }) => {
      expect(parseEdifactDateTime(value, code)).toBe("");
    });
  });

  describe("fields are checked, not clamped (TC39 overflow: reject)", () => {
    it.each`
      code     | value                  | reads
      ${"203"} | ${"202302291430"}      | ${"29 February 2023, not a leap year"}
      ${"203"} | ${"202406311430"}      | ${"31 June"}
      ${"203"} | ${"202413151430"}      | ${"month 13"}
      ${"203"} | ${"202406152430"}      | ${"hour 24"}
      ${"203"} | ${"202406151460"}      | ${"minute 60"}
      ${"204"} | ${"20240615143060"}    | ${"second 60: GMT rejects a leap second"}
      ${"203"} | ${"20240615T1430"}     | ${"a T separator"}
      ${"203"} | ${"2024-06-15T14:30"}  | ${"an ISO 8601 date-time: the value is the digits of the mask"}
      ${"203"} | ${"202406151430+0200"} | ${"205's value: an offset is read by parseEdifactOffsetDateTime"}
      ${"203"} | ${"2024061514３0"}     | ${"a full-width digit"}
      ${"203"} | ${"2406151430"}        | ${"YYMMDDHHMM: a two-digit year is not read"}
      ${"203"} | ${""}                  | ${"an empty value"}
    `("returns '' for $code $value ($reads)", ({ code, value }) => {
      expect(parseEdifactDateTime(value, code)).toBe("");
    });
  });

  describe("a code that does not state a local date-time", () => {
    it.each(edifactFormatsOutside("dateTime"))(
      "returns '' for code '$code' ($reads)",
      ({ code }) => {
        expect(parseEdifactDateTime("202406151430", code as never)).toBe("");
        expect(parseEdifactDateTime("2406151430", code as never)).toBe("");
        expect(parseEdifactDateTime("20240615", code as never)).toBe("");
      },
    );

    // The documented way to read a two-digit year: the pattern parser, with the century stated.
    it("a 201 value (YYMMDDHHMM) is read by parseDateTimeWithPattern with a yy pattern and a yearWindow", () => {
      expect(parseEdifactDateTime("2406151430", "201" as never)).toBe("");
      expect(
        parseDateTimeWithPattern("2406151430", "yyMMddHHmm", undefined, {
          yearWindow: 2000,
        }),
      ).toBe("2024-06-15T14:30:00");
    });
  });

  describe("non-string arguments", () => {
    it.each`
      argument    | call
      ${"value"}  | ${(bad: unknown) => parseEdifactDateTime(bad as never, "203")}
      ${"format"} | ${(bad: unknown) => parseEdifactDateTime("202406151430", bad as never)}
    `("returns '' for a $argument that is not a string", ({ call }) => {
      for (const [kind, make] of NON_STRINGS) {
        expect(call(make()), kind).toBe("");
      }
    });
  });

  it("returns '' when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(parseEdifactDateTime("202406151430", "203")).toBe("");
  });
});
