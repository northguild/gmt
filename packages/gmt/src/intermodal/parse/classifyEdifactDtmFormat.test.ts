import { expectTypeOf } from "vitest";
import {
  CUT_EDIFACT_FORMATS,
  EDIFACT_FORMAT_KINDS,
  NOT_EDIFACT_FORMATS,
} from "../../test/ediCodes";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import type {
  EdifactDateFormat,
  EdifactDatePeriodFormat,
  EdifactDateTimeFormat,
  EdifactDateTimePeriodFormat,
  EdifactDtmFormatClass,
  EdifactOffsetDateTimeFormat,
  EdifactTimeFormat,
} from "../../types/edi";
import type { EdifactDtmKind } from "../../internal/ediGrammar";
import { isValidEdifactDtmFormat } from "../validate/isValidEdifactDtmFormat";
import { classifyEdifactDtmFormat } from "./classifyEdifactDtmFormat";
import { parseEdifactDate } from "./parseEdifactDate";
import { parseEdifactDatePeriod } from "./parseEdifactDatePeriod";
import { parseEdifactDateTime } from "./parseEdifactDateTime";
import { parseEdifactDateTimePeriod } from "./parseEdifactDateTimePeriod";
import { parseEdifactOffsetDateTime } from "./parseEdifactOffsetDateTime";
import { parseEdifactTime } from "./parseEdifactTime";

/**
 * A generic `DTM` reader, written the way a caller writes one: the code and the value arrive as
 * strings, the classifier names the kind, and each branch calls that kind's parser with the
 * narrowed code. There is no cast: this function fails typecheck if a branch's `format` stops
 * being its kind's union.
 */
function readDtm(value: string, code: string): unknown {
  const classified = classifyEdifactDtmFormat(code);
  if (classified === null) {
    return null;
  }
  switch (classified.kind) {
    case "date":
      return parseEdifactDate(value, classified.format);
    case "time":
      return parseEdifactTime(value, classified.format);
    case "dateTime":
      return parseEdifactDateTime(value, classified.format);
    case "offsetDateTime":
      return parseEdifactOffsetDateTime(value, classified.format);
    case "datePeriod":
      return parseEdifactDatePeriod(value, classified.format);
    case "dateTimePeriod":
      return parseEdifactDateTimePeriod(value, classified.format);
  }
}

describe("classifyEdifactDtmFormat", () => {
  // The kind is what the directory's mask states: a date alone, a time alone, a date and a time,
  // a date and a time with an offset (`ZHHMM` or `ZZZ`), or two of one kind as a period.
  it.each`
    code     | mask                           | kind
    ${"102"} | ${"CCYYMMDD"}                  | ${"date"}
    ${"203"} | ${"CCYYMMDDHHMM"}              | ${"dateTime"}
    ${"204"} | ${"CCYYMMDDHHMMSS"}            | ${"dateTime"}
    ${"205"} | ${"CCYYMMDDHHMMZHHMM"}         | ${"offsetDateTime"}
    ${"208"} | ${"CCYYMMDDHHMMSSZHHMM"}       | ${"offsetDateTime"}
    ${"303"} | ${"CCYYMMDDHHMMZZZ"}           | ${"offsetDateTime"}
    ${"304"} | ${"CCYYMMDDHHMMSSZZZ"}         | ${"offsetDateTime"}
    ${"401"} | ${"HHMM"}                      | ${"time"}
    ${"402"} | ${"HHMMSS"}                    | ${"time"}
    ${"718"} | ${"CCYYMMDD-CCYYMMDD"}         | ${"datePeriod"}
    ${"719"} | ${"CCYYMMDDHHMM-CCYYMMDDHHMM"} | ${"dateTimePeriod"}
  `(
    "names $code ($mask) a $kind code, and returns the code beside the kind",
    ({ code, kind }) => {
      expect(classifyEdifactDtmFormat(code)).toEqual({ kind, format: code });
    },
  );

  it("agrees with the per-kind format unions for every supported code", () => {
    for (const [code, kind] of Object.entries(EDIFACT_FORMAT_KINDS)) {
      expect(classifyEdifactDtmFormat(code), code).toEqual({
        kind,
        format: code,
      });
    }
  });

  it("both members are always present, and each call returns a new object", () => {
    for (const code of Object.keys(EDIFACT_FORMAT_KINDS)) {
      const first = classifyEdifactDtmFormat(code);
      expect(Object.keys(first ?? {}), code).toEqual(["kind", "format"]);
      expect(classifyEdifactDtmFormat(code), code).not.toBe(first);
    }
  });

  describe("a code that arrives as data reaches its kind's parser with no cast", () => {
    // Each expected value is the wire value read off its code's mask by hand.
    it.each`
      code     | value                         | expected
      ${"102"} | ${"20240615"}                 | ${"2024-06-15"}
      ${"401"} | ${"1430"}                     | ${"14:30:00"}
      ${"204"} | ${"20240615143045"}           | ${"2024-06-15T14:30:45"}
      ${"303"} | ${"202406151430+02"}          | ${"2024-06-15T14:30:00+02:00"}
      ${"718"} | ${"2024061520240620"}         | ${{ start: "2024-06-15", end: "2024-06-20" }}
      ${"719"} | ${"202406151430202406201600"} | ${{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }}
      ${"101"} | ${"240615"}                   | ${null}
      ${"602"} | ${"2024"}                     | ${null}
    `(
      "a generic reader reads $value under $code as $expected",
      ({ code, value, expected }) => {
        expect(readDtm(value, code)).toEqual(expected);
      },
    );

    it("narrows format to the union of the kind it names", () => {
      const classified = classifyEdifactDtmFormat("102");
      expectTypeOf(classified).toEqualTypeOf<EdifactDtmFormatClass | null>();
      expectTypeOf<
        NonNullable<typeof classified>["kind"]
      >().toEqualTypeOf<EdifactDtmKind>();
      if (classified?.kind === "date") {
        expectTypeOf(classified.format).toEqualTypeOf<EdifactDateFormat>();
        // The call the narrowing exists for: no cast.
        expect(parseEdifactDate("20240615", classified.format)).toBe(
          "2024-06-15",
        );
      }
      if (classified?.kind === "time") {
        expectTypeOf(classified.format).toEqualTypeOf<EdifactTimeFormat>();
      }
      if (classified?.kind === "dateTime") {
        expectTypeOf(classified.format).toEqualTypeOf<EdifactDateTimeFormat>();
      }
      if (classified?.kind === "offsetDateTime") {
        expectTypeOf(
          classified.format,
        ).toEqualTypeOf<EdifactOffsetDateTimeFormat>();
      }
      if (classified?.kind === "datePeriod") {
        expectTypeOf(
          classified.format,
        ).toEqualTypeOf<EdifactDatePeriodFormat>();
      }
      if (classified?.kind === "dateTimePeriod") {
        expectTypeOf(
          classified.format,
        ).toEqualTypeOf<EdifactDateTimePeriodFormat>();
      }
      expect(classified?.kind).toBe("date");
    });
  });

  it.each(CUT_EDIFACT_FORMATS)(
    "returns null for the cut code $code ($reads)",
    ({ code }) => {
      expect(classifyEdifactDtmFormat(code)).toBeNull();
    },
  );

  it.each(NOT_EDIFACT_FORMATS)(
    "returns null for '$code' ($reads)",
    ({ code }) => {
      expect(classifyEdifactDtmFormat(code)).toBeNull();
    },
  );

  it("names a kind exactly for the codes isValidEdifactDtmFormat accepts", () => {
    const candidates = [
      ...Object.keys(EDIFACT_FORMAT_KINDS),
      ...CUT_EDIFACT_FORMATS.map(({ code }) => code),
      ...NOT_EDIFACT_FORMATS.map(({ code }) => code),
    ];
    for (const code of candidates) {
      expect(classifyEdifactDtmFormat(code) !== null, code).toBe(
        isValidEdifactDtmFormat(code),
      );
    }
  });

  it("returns null for a code that is not a string", () => {
    const nonStrings: [string, unknown][] = [
      ["the number 203", 203],
      ["null", null],
      ["undefined", undefined],
      ["a boolean", true],
      ["an array holding a code", ["203"]],
      ["an object", {}],
      ["a Proxy that throws on any trap", hostileProxy()],
      ["a revoked Proxy", revokedProxy()],
    ];
    for (const [kind, value] of nonStrings) {
      expect(classifyEdifactDtmFormat(value as never), kind).toBeNull();
    }
  });
});
