import { expectTypeOf } from "vitest";
import { X12_TIME_CODES } from "../../internal";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { X12_TIME_CODE_EXPECTATIONS } from "../../test/x12TimeCodeMatrix";
import type {
  X12OffsetTimeCode,
  X12TimeCodeClass,
  X12ZoneTimeCode,
} from "../../types/edi";
import { isValidX12TimeCode } from "../validate/isValidX12TimeCode";
import { classifyX12TimeCode } from "./classifyX12TimeCode";
import { x12TimeCodeOffset } from "./x12TimeCodeOffset";
import { x12TimeCodeZone } from "./x12TimeCodeZone";

/**
 * A time-code reader, written the way a caller writes one: the code arrives as a string, the
 * classifier says whether it states an offset or names a zone, and each branch calls that
 * reader with the narrowed code. There is no cast: this function fails typecheck if a branch's
 * `timeCode` stops being its reader's union.
 */
function readTimeCode(code: string): unknown {
  const classified = classifyX12TimeCode(code);
  if (classified === null) {
    return null;
  }
  return classified.kind === "offset"
    ? x12TimeCodeOffset(classified.timeCode)
    : x12TimeCodeZone(classified.timeCode);
}

/**
 * Every expected kind is read off the X12 data element 623 code list (release 008010, Stedi's
 * X12-licensed dictionary): a code whose definition is an ISO designator, `UT` or `GM` states an
 * offset, and a code whose definition is a zone name names a zone.
 */
describe("classifyX12TimeCode", () => {
  it.each`
    timeCode | definition                     | kind
    ${"01"}  | ${"Equivalent to ISO P01"}     | ${"offset"}
    ${"12"}  | ${"Equivalent to ISO P12"}     | ${"offset"}
    ${"13"}  | ${"Equivalent to ISO M12"}     | ${"offset"}
    ${"20"}  | ${"Equivalent to ISO M05"}     | ${"offset"}
    ${"24"}  | ${"Equivalent to ISO M01"}     | ${"offset"}
    ${"27"}  | ${"Equivalent to ISO P5:30"}   | ${"offset"}
    ${"UT"}  | ${"Universal Time Coordinate"} | ${"offset"}
    ${"GM"}  | ${"Greenwich Mean Time"}       | ${"offset"}
    ${"ED"}  | ${"Eastern Daylight Time"}     | ${"zone"}
    ${"ES"}  | ${"Eastern Standard Time"}     | ${"zone"}
    ${"ET"}  | ${"Eastern Time"}              | ${"zone"}
    ${"TS"}  | ${"Atlantic Standard Time"}    | ${"zone"}
    ${"LT"}  | ${"Local Time"}                | ${"zone"}
  `(
    "names $timeCode ($definition) an $kind code, and returns the code beside the kind",
    ({ timeCode, kind }) => {
      expect(classifyX12TimeCode(timeCode)).toEqual({ kind, timeCode });
    },
  );

  describe("the 56-code list", () => {
    const rows = X12_TIME_CODES.map((timeCode) => ({
      timeCode,
      ...X12_TIME_CODE_EXPECTATIONS[timeCode],
      kind:
        "offset" in X12_TIME_CODE_EXPECTATIONS[timeCode] ? "offset" : "zone",
    }));

    it.each(rows)(
      "$timeCode ($definition) is an $kind code, read by that kind's reader and not the other",
      ({ timeCode, kind }) => {
        expect(classifyX12TimeCode(timeCode)).toEqual({ kind, timeCode });
        expect(x12TimeCodeOffset(timeCode as never) !== "").toBe(
          kind === "offset",
        );
        expect(x12TimeCodeZone(timeCode as never) !== null).toBe(
          kind === "zone",
        );
      },
    );

    it("31 codes state an offset and 25 name a zone", () => {
      const kinds = X12_TIME_CODES.map(
        (timeCode) => classifyX12TimeCode(timeCode)?.kind,
      );
      expect(kinds.filter((kind) => kind === "offset")).toHaveLength(31);
      expect(kinds.filter((kind) => kind === "zone")).toHaveLength(25);
      expect(kinds).toHaveLength(56);
    });

    it("both members are always present, and each call returns a new object", () => {
      for (const timeCode of X12_TIME_CODES) {
        const first = classifyX12TimeCode(timeCode);
        expect(Object.keys(first ?? {}), timeCode).toEqual([
          "kind",
          "timeCode",
        ]);
        expect(classifyX12TimeCode(timeCode), timeCode).not.toBe(first);
      }
    });
  });

  describe("a code that arrives as data reaches its reader with no cast", () => {
    it.each`
      timeCode | expected
      ${"20"}  | ${"-05:00"}
      ${"UT"}  | ${"+00:00"}
      ${"27"}  | ${"+05:30"}
      ${"ES"}  | ${{ zone: "Eastern", daylight: false }}
      ${"LT"}  | ${{ zone: "Local", daylight: null }}
      ${"EST"} | ${null}
    `("a reader reads $timeCode as $expected", ({ timeCode, expected }) => {
      expect(readTimeCode(timeCode)).toEqual(expected);
    });

    it("narrows timeCode to the union of the reader it names", () => {
      const classified = classifyX12TimeCode("20");
      expectTypeOf(classified).toEqualTypeOf<X12TimeCodeClass | null>();
      if (classified?.kind === "offset") {
        expectTypeOf(classified.timeCode).toEqualTypeOf<X12OffsetTimeCode>();
        // The call the narrowing exists for: no cast.
        expect(x12TimeCodeOffset(classified.timeCode)).toBe("-05:00");
      }
      if (classified?.kind === "zone") {
        expectTypeOf(classified.timeCode).toEqualTypeOf<X12ZoneTimeCode>();
      }
      expect(classified?.kind).toBe("offset");
    });
  });

  // Membership is by the list, never by shape, and matching is exact.
  it.each`
    timeCode         | reads
    ${"et"}          | ${"lower case: matching is exact"}
    ${" ET"}         | ${"a leading space"}
    ${"ET "}         | ${"a trailing space"}
    ${"1"}           | ${"one digit: the code is 01"}
    ${"00"}          | ${"below the numeric run"}
    ${"30"}          | ${"above the numeric run"}
    ${"EST"}         | ${"an abbreviation, not a 623 code"}
    ${"Z"}           | ${"the ISO 8601 UTC designator"}
    ${"UTC"}         | ${"UTC is UT in 623"}
    ${"+01:00"}      | ${"an offset, not a code"}
    ${"DT"}          | ${"a 1250 format code, not a 623 time code"}
    ${""}            | ${"an empty string"}
    ${"toString"}    | ${"an inherited property name"}
    ${"constructor"} | ${"an inherited property name"}
    ${"__proto__"}   | ${"an inherited property name"}
  `(
    "returns null for '$timeCode' ($reads), as isValidX12TimeCode is false for it",
    ({ timeCode }) => {
      expect(classifyX12TimeCode(timeCode)).toBeNull();
      expect(isValidX12TimeCode(timeCode)).toBe(false);
    },
  );

  it("returns null for a time code that is not a string", () => {
    const nonStrings: [string, () => unknown][] = [
      ["null", () => null],
      ["undefined", () => undefined],
      ["a number", () => 1],
      ["a boolean", () => true],
      ["an array holding a code", () => ["ET"]],
      ["an object", () => ({ ET: true })],
      ["a Proxy that throws on any trap", hostileProxy],
      ["a revoked Proxy", revokedProxy],
    ];
    for (const [kind, make] of nonStrings) {
      expect(classifyX12TimeCode(make() as never), kind).toBeNull();
    }
  });
});
