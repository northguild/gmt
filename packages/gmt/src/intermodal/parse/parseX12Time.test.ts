import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import {
  CUT_X12_FORMATS,
  NON_STRINGS,
  x12FormatsOutside,
} from "../../test/ediCodes";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { parseX12Time } from "./parseX12Time";

/**
 * Every expected value is read off X12 data element 337 by hand: "HHMM, or HHMMSS, or HHMMSSD,
 * or HHMMSSDD … D = tenths (0-9) and DD = hundredths (00-99)". One digit of decimal seconds is
 * tenths (0.1 s) and two are hundredths (0.12 s).
 */
describe("parseX12Time", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("the four element 337 forms: 4, 6, 7 or 8 digits", () => {
    it.each`
      value         | expected         | reads
      ${"1430"}     | ${"14:30:00"}    | ${"HHMM (the TM form): seconds are written as 00"}
      ${"0000"}     | ${"00:00:00"}    | ${"midnight"}
      ${"2359"}     | ${"23:59:00"}    | ${"the last minute of the day"}
      ${"143045"}   | ${"14:30:45"}    | ${"HHMMSS (the TS form)"}
      ${"235959"}   | ${"23:59:59"}    | ${"the last second of the day"}
      ${"2359599"}  | ${"23:59:59.9"}  | ${"the last tenth of the day"}
      ${"1430001"}  | ${"14:30:00.1"}  | ${"HHMMSSD: one tenth"}
      ${"1430459"}  | ${"14:30:45.9"}  | ${"nine tenths"}
      ${"14300012"} | ${"14:30:00.12"} | ${"HHMMSSDD: twelve hundredths"}
      ${"14304505"} | ${"14:30:45.05"} | ${"five hundredths"}
      ${"14304550"} | ${"14:30:45.5"}  | ${"fifty hundredths is five tenths: no trailing zero"}
      ${"23595999"} | ${"23:59:59.99"} | ${"the last hundredth of the day"}
    `("reads $value as $expected ($reads)", ({ value, expected }) => {
      expect(Temporal.PlainTime.from(expected).toString()).toBe(expected);
      expect(parseX12Time(value)).toBe(expected);
    });

    // A zero fraction is not written.
    it.each`
      value         | expected
      ${"1430000"}  | ${"14:30:00"}
      ${"14300000"} | ${"14:30:00"}
      ${"1430450"}  | ${"14:30:45"}
    `(
      "reads $value as $expected: a zero fraction is not written",
      ({ value, expected }) => {
        expect(parseX12Time(value)).toBe(expected);
      },
    );
  });

  describe("fields are checked, not clamped (TC39 overflow: reject)", () => {
    it.each`
      value           | reads
      ${"2400"}       | ${"hour 24"}
      ${"1460"}       | ${"minute 60"}
      ${"143060"}     | ${"second 60: GMT rejects a leap second"}
      ${"24000000"}   | ${"hour 24 in the eight-digit form"}
      ${"23596099"}   | ${"second 60 with hundredths"}
      ${"14"}         | ${"two digits: an hour alone"}
      ${"143"}        | ${"three digits"}
      ${"14304"}      | ${"five digits is not an element 337 form"}
      ${"143045123"}  | ${"nine digits: thousandths are not an element 337 form"}
      ${"1430451234"} | ${"ten digits"}
      ${"-1430"}      | ${"a sign"}
      ${"1430\n"}     | ${"a trailing line feed"}
      ${"14:30"}      | ${"a colon: the value is the digits of the element"}
      ${"1430.5"}     | ${"a decimal point"}
      ${"930"}        | ${"an unpadded hour"}
      ${" 1430"}      | ${"a leading space"}
      ${"1430 "}      | ${"a trailing space"}
      ${"１４３０"}   | ${"full-width digits"}
      ${"1430ET"}     | ${"a time code is its own element: read it with x12TimeCodeZone"}
      ${"0900-1700"}  | ${"an RTM range of times is not read"}
      ${""}           | ${"an empty value"}
    `("returns '' for $value ($reads)", ({ value }) => {
      expect(parseX12Time(value)).toBe("");
    });
  });

  describe("with a 1250 format qualifier, the value is that qualifier's mask exactly", () => {
    // X12 data element 1250: `TM` is "Time Expressed in Format HHMM" and `TS` is "Time Expressed
    // in Format HHMMSS". A `DTP` segment and `DTM-05`/`06` send a time with its qualifier, and no
    // 1250 code holds decimal seconds.
    it.each`
      format  | value       | expected      | reads
      ${"TM"} | ${"1430"}   | ${"14:30:00"} | ${"HHMM: seconds are written as 00"}
      ${"TM"} | ${"0000"}   | ${"00:00:00"} | ${"midnight"}
      ${"TM"} | ${"2359"}   | ${"23:59:00"} | ${"the last minute of the day"}
      ${"TS"} | ${"143045"} | ${"14:30:45"} | ${"HHMMSS"}
      ${"TS"} | ${"143000"} | ${"14:30:00"} | ${"zero seconds"}
      ${"TS"} | ${"235959"} | ${"23:59:59"} | ${"the last second of the day"}
    `(
      "reads $value under $format as $expected ($reads)",
      ({ format, value, expected }) => {
        expect(parseX12Time(value, format)).toBe(expected);
        // The same digits are an element 337 form too.
        expect(parseX12Time(value)).toBe(expected);
      },
    );

    // Each value is an element 337 form, read with no qualifier, and is not its qualifier's
    // mask: `unqualified` is the element 337 reading, by hand.
    it.each`
      format  | value         | unqualified      | reads
      ${"TM"} | ${"143045"}   | ${"14:30:45"}    | ${"six digits is a TS value"}
      ${"TS"} | ${"1430"}     | ${"14:30:00"}    | ${"four digits is a TM value"}
      ${"TM"} | ${"1430451"}  | ${"14:30:45.1"}  | ${"HHMMSSD: no 1250 code holds tenths"}
      ${"TS"} | ${"1430451"}  | ${"14:30:45.1"}  | ${"HHMMSSD: no 1250 code holds tenths"}
      ${"TM"} | ${"14300012"} | ${"14:30:00.12"} | ${"HHMMSSDD: no 1250 code holds hundredths"}
      ${"TS"} | ${"14300012"} | ${"14:30:00.12"} | ${"HHMMSSDD: no 1250 code holds hundredths"}
      ${"TS"} | ${"14304500"} | ${"14:30:45"}    | ${"a zero fraction is still eight digits"}
    `(
      "returns '' for $value under $format ($reads), and reads it as $unqualified with no qualifier",
      ({ format, value, unqualified }) => {
        expect(parseX12Time(value, format)).toBe("");
        expect(parseX12Time(value)).toBe(unqualified);
      },
    );

    it.each`
      format  | value       | reads
      ${"TM"} | ${"2400"}   | ${"hour 24"}
      ${"TM"} | ${"1460"}   | ${"minute 60"}
      ${"TS"} | ${"143060"} | ${"second 60: GMT rejects a leap second"}
      ${"TM"} | ${"14:30"}  | ${"a colon"}
      ${"TM"} | ${""}       | ${"an empty value"}
    `("returns '' for $value under $format ($reads)", ({ format, value }) => {
      expect(parseX12Time(value, format)).toBe("");
    });

    it("an explicit undefined format is the unqualified read", () => {
      expect(parseX12Time("14300012", undefined)).toBe("14:30:00.12");
      expect(parseX12Time("1430", undefined)).toBe("14:30:00");
    });

    // A format that is present and is not `TM` or `TS` is the sentinel, never a fallback to the
    // unqualified read: each value below is a valid element 337 form.
    it.each(x12FormatsOutside("time"))(
      "returns '' for the format '$code' ($reads)",
      ({ code }) => {
        expect(parseX12Time("1430", code as never)).toBe("");
        expect(parseX12Time("143045", code as never)).toBe("");
        expect(parseX12Time("14300012", code as never)).toBe("");
      },
    );

    it("returns '' for every cut code, with the code's own value too", () => {
      for (const { code, value } of CUT_X12_FORMATS) {
        expect(parseX12Time(value, code as never), code).toBe("");
        expect(parseX12Time("1430", code as never), code).toBe("");
      }
    });

    it("returns '' for a format that is not a string and not undefined", () => {
      for (const [kind, make] of NON_STRINGS) {
        const format = make();
        if (format === undefined) {
          continue;
        }
        expect(parseX12Time("1430", format as never), kind).toBe("");
      }
    });
  });

  it("returns '' for a value that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(parseX12Time(make() as never), kind).toBe("");
    }
  });

  it("returns '' when Temporal.PlainTime.from throws", () => {
    mockTemporalPlainTimeFromThrow();
    expect(parseX12Time("1430")).toBe("");
  });
});
