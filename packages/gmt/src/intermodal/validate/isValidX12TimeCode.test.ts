import { hostileProxy, revokedProxy } from "../../test/noThrow";
import type { X12TimeCode } from "../../types/edi";
import { x12TimeCodeOffset } from "../parse/x12TimeCodeOffset";
import { x12TimeCodeZone } from "../parse/x12TimeCodeZone";
import { isValidX12TimeCode } from "./isValidX12TimeCode";

/** Whether one of the two readers reads the code: an offset, or a zone. */
function isRead(timeCode: unknown): boolean {
  return (
    x12TimeCodeOffset(timeCode as never) !== "" ||
    x12TimeCodeZone(timeCode as never) !== null
  );
}

describe("isValidX12TimeCode", () => {
  // The 56 codes of X12 data element 623, release 008010, with each definition as Stedi's
  // X12-licensed dictionary prints it. Release 005010 has the 51 other than 25–29.
  it.each`
    timeCode | definition
    ${"01"}  | ${"Equivalent to ISO P01"}
    ${"02"}  | ${"Equivalent to ISO P02"}
    ${"03"}  | ${"Equivalent to ISO P03"}
    ${"04"}  | ${"Equivalent to ISO P04"}
    ${"05"}  | ${"Equivalent to ISO P05"}
    ${"06"}  | ${"Equivalent to ISO P06"}
    ${"07"}  | ${"Equivalent to ISO P07"}
    ${"08"}  | ${"Equivalent to ISO P08"}
    ${"09"}  | ${"Equivalent to ISO P09"}
    ${"10"}  | ${"Equivalent to ISO P10"}
    ${"11"}  | ${"Equivalent to ISO P11"}
    ${"12"}  | ${"Equivalent to ISO P12"}
    ${"13"}  | ${"Equivalent to ISO M12"}
    ${"14"}  | ${"Equivalent to ISO M11"}
    ${"15"}  | ${"Equivalent to ISO M10"}
    ${"16"}  | ${"Equivalent to ISO M09"}
    ${"17"}  | ${"Equivalent to ISO M08"}
    ${"18"}  | ${"Equivalent to ISO M07"}
    ${"19"}  | ${"Equivalent to ISO M06"}
    ${"20"}  | ${"Equivalent to ISO M05"}
    ${"21"}  | ${"Equivalent to ISO M04"}
    ${"22"}  | ${"Equivalent to ISO M03"}
    ${"23"}  | ${"Equivalent to ISO M02"}
    ${"24"}  | ${"Equivalent to ISO M01"}
    ${"25"}  | ${"Equivalent to ISO M2:30"}
    ${"26"}  | ${"Equivalent to ISO M3:30"}
    ${"27"}  | ${"Equivalent to ISO P5:30"}
    ${"28"}  | ${"Equivalent to ISO P9:30"}
    ${"29"}  | ${"Equivalent to ISO P10:30"}
    ${"AD"}  | ${"Alaska Daylight Time"}
    ${"AS"}  | ${"Alaska Standard Time"}
    ${"AT"}  | ${"Alaska Time"}
    ${"CD"}  | ${"Central Daylight Time"}
    ${"CS"}  | ${"Central Standard Time"}
    ${"CT"}  | ${"Central Time"}
    ${"ED"}  | ${"Eastern Daylight Time"}
    ${"ES"}  | ${"Eastern Standard Time"}
    ${"ET"}  | ${"Eastern Time"}
    ${"GM"}  | ${"Greenwich Mean Time"}
    ${"HD"}  | ${"Hawaii-Aleutian Daylight Time"}
    ${"HS"}  | ${"Hawaii-Aleutian Standard Time"}
    ${"HT"}  | ${"Hawaii-Aleutian Time"}
    ${"LT"}  | ${"Local Time"}
    ${"MD"}  | ${"Mountain Daylight Time"}
    ${"MS"}  | ${"Mountain Standard Time"}
    ${"MT"}  | ${"Mountain Time"}
    ${"ND"}  | ${"Newfoundland Daylight Time"}
    ${"NS"}  | ${"Newfoundland Standard Time"}
    ${"NT"}  | ${"Newfoundland Time"}
    ${"PD"}  | ${"Pacific Daylight Time"}
    ${"PS"}  | ${"Pacific Standard Time"}
    ${"PT"}  | ${"Pacific Time"}
    ${"TD"}  | ${"Atlantic Daylight Time"}
    ${"TS"}  | ${"Atlantic Standard Time"}
    ${"TT"}  | ${"Atlantic Time"}
    ${"UT"}  | ${"Universal Time Coordinate"}
  `(
    "returns true for $timeCode ($definition), which exactly one of x12TimeCodeOffset and x12TimeCodeZone reads",
    ({ timeCode }) => {
      expect(isValidX12TimeCode(timeCode)).toBe(true);
      expect(isRead(timeCode)).toBe(true);
      expect(
        x12TimeCodeOffset(timeCode) !== "" &&
          x12TimeCodeZone(timeCode) !== null,
      ).toBe(false);
    },
  );

  // Membership is by the list, never by shape, and matching is exact. Each row is also the two
  // readers' answer: neither reads a code the validator refuses.
  it.each`
    timeCode         | reads
    ${"et"}          | ${"lower case: matching is exact"}
    ${"Et"}          | ${"mixed case"}
    ${" ET"}         | ${"a leading space"}
    ${"ET "}         | ${"a trailing space"}
    ${"1"}           | ${"one digit: the code is 01"}
    ${"001"}         | ${"three digits"}
    ${"00"}          | ${"below the numeric run"}
    ${"30"}          | ${"above the numeric run"}
    ${"99"}          | ${"two digits far past the numeric run"}
    ${"EST"}         | ${"an abbreviation, not a 623 code"}
    ${"EDT"}         | ${"an abbreviation, not a 623 code"}
    ${"Z"}           | ${"the ISO 8601 UTC designator"}
    ${"UTC"}         | ${"UTC is UT in 623"}
    ${"GMT"}         | ${"GMT is GM in 623"}
    ${"+01:00"}      | ${"an offset, not a code"}
    ${"DT"}          | ${"a 1250 format code, not a 623 time code"}
    ${"LS"}          | ${"two letters shaped like a standard-time code"}
    ${"ZZ"}          | ${"an unknown code"}
    ${""}            | ${"an empty string"}
    ${"toString"}    | ${"an inherited property name"}
    ${"constructor"} | ${"an inherited property name"}
  `(
    "returns false for '$timeCode' ($reads), which neither x12TimeCodeOffset nor x12TimeCodeZone reads",
    ({ timeCode }) => {
      expect(isValidX12TimeCode(timeCode)).toBe(false);
      expect(isRead(timeCode)).toBe(false);
    },
  );

  it("returns false for a time code that is not a string, which neither reader reads", () => {
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
      expect(isValidX12TimeCode(make()), kind).toBe(false);
      expect(isRead(make()), kind).toBe(false);
    }
  });

  it("narrows an unknown value to X12TimeCode", () => {
    const candidate: unknown = "ES";
    // The guard is the only thing that makes this assignment typecheck.
    const narrowed: X12TimeCode | null = isValidX12TimeCode(candidate)
      ? candidate
      : null;
    expect(narrowed).toBe("ES");
  });
});
