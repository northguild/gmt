import { expectTypeOf } from "vitest";
import {
  CUT_X12_FORMATS,
  NOT_X12_FORMATS,
  X12_FORMAT_KINDS,
} from "../../test/ediCodes";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import type {
  X12DateFormat,
  X12DateRangeFormat,
  X12DateTimeFormat,
  X12DateTimePeriodFormatClass,
  X12DateTimeRangeFormat,
  X12TimeFormat,
} from "../../types/edi";
import type { X12DateTimePeriodKind } from "../../internal/ediGrammar";
import { formatX12Time } from "../format/formatX12Time";
import { isValidX12DateTimePeriodFormat } from "../validate/isValidX12DateTimePeriodFormat";
import { classifyX12DateTimePeriodFormat } from "./classifyX12DateTimePeriodFormat";
import { parseX12Date } from "./parseX12Date";
import { parseX12DateRange } from "./parseX12DateRange";
import { parseX12DateTime } from "./parseX12DateTime";
import { parseX12DateTimeRange } from "./parseX12DateTimeRange";
import { parseX12Time } from "./parseX12Time";

/**
 * A generic `DTP` reader, written the way a caller writes one: the qualifier and the value
 * arrive as strings, the classifier names the kind, and each branch calls that kind's parser
 * with the narrowed code. There is no cast: this function fails typecheck if a branch's `format`
 * stops being its kind's union.
 */
function readDtp(value: string, code: string): unknown {
  const classified = classifyX12DateTimePeriodFormat(code);
  if (classified === null) {
    return null;
  }
  switch (classified.kind) {
    case "date":
      return parseX12Date(value, classified.format);
    case "time":
      // A time that arrives with its qualifier is read against that qualifier's mask.
      return parseX12Time(value, classified.format);
    case "dateTime":
      return parseX12DateTime(value, classified.format);
    case "dateRange":
      return parseX12DateRange(value, classified.format);
    case "dateTimeRange":
      return parseX12DateTimeRange(value, classified.format);
  }
}

describe("classifyX12DateTimePeriodFormat", () => {
  // The kind is what the dictionary's mask states: a date alone, a time alone, a date and a
  // time, or two of one kind as a range. `RTS` is one date-time despite its `R`, and `DTS` is a
  // range despite having none.
  it.each`
    code     | mask                               | kind
    ${"D8"}  | ${"CCYYMMDD"}                      | ${"date"}
    ${"DB"}  | ${"MMDDCCYY"}                      | ${"date"}
    ${"DT"}  | ${"CCYYMMDDHHMM"}                  | ${"dateTime"}
    ${"RTS"} | ${"CCYYMMDDHHMMSS"}                | ${"dateTime"}
    ${"TM"}  | ${"HHMM"}                          | ${"time"}
    ${"TS"}  | ${"HHMMSS"}                        | ${"time"}
    ${"RD8"} | ${"CCYYMMDD-CCYYMMDD"}             | ${"dateRange"}
    ${"RD"}  | ${"MMDDCCYY-MMDDCCYY"}             | ${"dateRange"}
    ${"RDT"} | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"}     | ${"dateTimeRange"}
    ${"DTS"} | ${"CCYYMMDDHHMMSS-CCYYMMDDHHMMSS"} | ${"dateTimeRange"}
  `(
    "names $code ($mask) a $kind code, and returns the code beside the kind",
    ({ code, kind }) => {
      expect(classifyX12DateTimePeriodFormat(code)).toEqual({
        kind,
        format: code,
      });
    },
  );

  it("agrees with the per-kind format unions for every supported code", () => {
    for (const [code, kind] of Object.entries(X12_FORMAT_KINDS)) {
      expect(classifyX12DateTimePeriodFormat(code), code).toEqual({
        kind,
        format: code,
      });
    }
  });

  it("both members are always present, and each call returns a new object", () => {
    for (const code of Object.keys(X12_FORMAT_KINDS)) {
      const first = classifyX12DateTimePeriodFormat(code);
      expect(Object.keys(first ?? {}), code).toEqual(["kind", "format"]);
      expect(classifyX12DateTimePeriodFormat(code), code).not.toBe(first);
    }
  });

  describe("a code that arrives as data reaches its kind's parser with no cast", () => {
    // Each expected value is the wire value read off its code's mask by hand.
    it.each`
      code     | value                              | expected
      ${"D8"}  | ${"20240615"}                      | ${"2024-06-15"}
      ${"DB"}  | ${"06152024"}                      | ${"2024-06-15"}
      ${"TM"}  | ${"1430"}                          | ${"14:30:00"}
      ${"TS"}  | ${"143045"}                        | ${"14:30:45"}
      ${"TM"}  | ${"143045"}                        | ${""}
      ${"TS"}  | ${"14300012"}                      | ${""}
      ${"RTS"} | ${"20240615143045"}                | ${"2024-06-15T14:30:45"}
      ${"RD8"} | ${"20240615-20240620"}             | ${{ start: "2024-06-15", end: "2024-06-20" }}
      ${"DTS"} | ${"20240615143045-20240620160030"} | ${{ start: "2024-06-15T14:30:45", end: "2024-06-20T16:00:30" }}
      ${"D6"}  | ${"240615"}                        | ${null}
      ${"UN"}  | ${"20240615"}                      | ${null}
    `(
      "a generic reader reads $value under $code as $expected",
      ({ code, value, expected }) => {
        expect(readDtp(value, code)).toEqual(expected);
      },
    );

    it("narrows format to the union of the kind it names", () => {
      const classified = classifyX12DateTimePeriodFormat("TS");
      expectTypeOf(
        classified,
      ).toEqualTypeOf<X12DateTimePeriodFormatClass | null>();
      expectTypeOf<
        NonNullable<typeof classified>["kind"]
      >().toEqualTypeOf<X12DateTimePeriodKind>();
      if (classified?.kind === "date") {
        expectTypeOf(classified.format).toEqualTypeOf<X12DateFormat>();
      }
      if (classified?.kind === "time") {
        expectTypeOf(classified.format).toEqualTypeOf<X12TimeFormat>();
        // The call the narrowing exists for: no cast.
        expect(formatX12Time("14:30:45", classified.format)).toBe("143045");
      }
      if (classified?.kind === "dateTime") {
        expectTypeOf(classified.format).toEqualTypeOf<X12DateTimeFormat>();
      }
      if (classified?.kind === "dateRange") {
        expectTypeOf(classified.format).toEqualTypeOf<X12DateRangeFormat>();
      }
      if (classified?.kind === "dateTimeRange") {
        expectTypeOf(classified.format).toEqualTypeOf<X12DateTimeRangeFormat>();
      }
      expect(classified?.kind).toBe("time");
    });
  });

  it.each(CUT_X12_FORMATS)(
    "returns null for the cut code $code ($reads)",
    ({ code }) => {
      expect(classifyX12DateTimePeriodFormat(code)).toBeNull();
    },
  );

  it.each(NOT_X12_FORMATS)("returns null for '$code' ($reads)", ({ code }) => {
    expect(classifyX12DateTimePeriodFormat(code)).toBeNull();
  });

  // `ET` is a data element 623 time code, not a 1250 format qualifier.
  it("returns null for a 623 time code that is not a 1250 code", () => {
    expect(classifyX12DateTimePeriodFormat("ET")).toBeNull();
    expect(classifyX12DateTimePeriodFormat("UT")).toBeNull();
  });

  it("names a kind exactly for the codes isValidX12DateTimePeriodFormat accepts", () => {
    const candidates = [
      ...Object.keys(X12_FORMAT_KINDS),
      ...CUT_X12_FORMATS.map(({ code }) => code),
      ...NOT_X12_FORMATS.map(({ code }) => code),
    ];
    for (const code of candidates) {
      expect(classifyX12DateTimePeriodFormat(code) !== null, code).toBe(
        isValidX12DateTimePeriodFormat(code),
      );
    }
  });

  it("returns null for a code that is not a string", () => {
    const nonStrings: [string, unknown][] = [
      ["null", null],
      ["undefined", undefined],
      ["a number", 8],
      ["a boolean", true],
      ["an array holding a code", ["D8"]],
      ["an object", { D8: true }],
      ["a Proxy that throws on any trap", hostileProxy()],
      ["a revoked Proxy", revokedProxy()],
    ];
    for (const [kind, value] of nonStrings) {
      expect(classifyX12DateTimePeriodFormat(value as never), kind).toBeNull();
    }
  });
});
