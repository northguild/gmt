import { Temporal } from "@js-temporal/polyfill";
import { X12_TIME_CODES } from "../../internal";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { X12_TIME_CODE_EXPECTATIONS } from "../../test/x12TimeCodeMatrix";
import { x12TimeCode } from "./x12TimeCode";

/**
 * Every expected value is read off the X12 data element 623 code list (release 008010, Stedi's
 * X12-licensed dictionary; `25`–`29` were added in release 006010): the `designator` column is the definition's own text after
 * "Equivalent to ISO", where `P` is plus and `M` is minus. `minutes` is that designator worked
 * out by hand as signed minutes from UTC, and each row checks the expected offset string against
 * it through plain Temporal, so a wrong sign or a wrong hour in either column fails.
 */
function offsetMinutes(offset: string): number {
  return (
    Temporal.Instant.from("2024-01-01T00:00:00Z").toZonedDateTimeISO(offset)
      .offsetNanoseconds / 60_000_000_000
  );
}

describe("x12TimeCode", () => {
  describe("01–12: 'Equivalent to ISO P01' … 'P12' (UTC+1 … UTC+12, ascending)", () => {
    it.each`
      timeCode | designator | minutes | offset
      ${"01"}  | ${"P01"}   | ${60}   | ${"+01:00"}
      ${"02"}  | ${"P02"}   | ${120}  | ${"+02:00"}
      ${"03"}  | ${"P03"}   | ${180}  | ${"+03:00"}
      ${"04"}  | ${"P04"}   | ${240}  | ${"+04:00"}
      ${"05"}  | ${"P05"}   | ${300}  | ${"+05:00"}
      ${"06"}  | ${"P06"}   | ${360}  | ${"+06:00"}
      ${"07"}  | ${"P07"}   | ${420}  | ${"+07:00"}
      ${"08"}  | ${"P08"}   | ${480}  | ${"+08:00"}
      ${"09"}  | ${"P09"}   | ${540}  | ${"+09:00"}
      ${"10"}  | ${"P10"}   | ${600}  | ${"+10:00"}
      ${"11"}  | ${"P11"}   | ${660}  | ${"+11:00"}
      ${"12"}  | ${"P12"}   | ${720}  | ${"+12:00"}
    `(
      "reads $timeCode (ISO $designator) as the offset $offset",
      ({ timeCode, minutes, offset }) => {
        expect(offsetMinutes(offset)).toBe(minutes);
        expect(x12TimeCode(timeCode)).toEqual({ offset });
      },
    );
  });

  describe("13–24: 'Equivalent to ISO M12' … 'M01' (UTC−12 … UTC−1, descending)", () => {
    // The run counts down: the code rises as the distance from UTC falls, so 13 is the furthest
    // west and 24 the nearest (code k is UTC−(25 − k)). Read as ascending, code k would be
    // UTC−(k − 12); the two agree for no whole k, so every one of these twelve rows fails.
    it.each`
      timeCode | designator | minutes | offset
      ${"13"}  | ${"M12"}   | ${-720} | ${"-12:00"}
      ${"14"}  | ${"M11"}   | ${-660} | ${"-11:00"}
      ${"15"}  | ${"M10"}   | ${-600} | ${"-10:00"}
      ${"16"}  | ${"M09"}   | ${-540} | ${"-09:00"}
      ${"17"}  | ${"M08"}   | ${-480} | ${"-08:00"}
      ${"18"}  | ${"M07"}   | ${-420} | ${"-07:00"}
      ${"19"}  | ${"M06"}   | ${-360} | ${"-06:00"}
      ${"20"}  | ${"M05"}   | ${-300} | ${"-05:00"}
      ${"21"}  | ${"M04"}   | ${-240} | ${"-04:00"}
      ${"22"}  | ${"M03"}   | ${-180} | ${"-03:00"}
      ${"23"}  | ${"M02"}   | ${-120} | ${"-02:00"}
      ${"24"}  | ${"M01"}   | ${-60}  | ${"-01:00"}
    `(
      "reads $timeCode (ISO $designator) as the offset $offset",
      ({ timeCode, minutes, offset }) => {
        expect(offsetMinutes(offset)).toBe(minutes);
        expect(x12TimeCode(timeCode)).toEqual({ offset });
      },
    );
  });

  describe("25–29: the half-hour offsets", () => {
    it.each`
      timeCode | designator  | minutes | offset
      ${"25"}  | ${"M2:30"}  | ${-150} | ${"-02:30"}
      ${"26"}  | ${"M3:30"}  | ${-210} | ${"-03:30"}
      ${"27"}  | ${"P5:30"}  | ${330}  | ${"+05:30"}
      ${"28"}  | ${"P9:30"}  | ${570}  | ${"+09:30"}
      ${"29"}  | ${"P10:30"} | ${630}  | ${"+10:30"}
    `(
      "reads $timeCode (ISO $designator) as the offset $offset",
      ({ timeCode, minutes, offset }) => {
        expect(offsetMinutes(offset)).toBe(minutes);
        expect(x12TimeCode(timeCode)).toEqual({ offset });
      },
    );
  });

  describe("UT and GM: UTC", () => {
    // UT is UTC by its definition. GM is UTC by a GMT rule: X12 gives only the name, and UN/ECE
    // Recommendation 7 ¶12 names the scale "Co-ordinated Universal Time (formerly known as
    // Greenwich Mean Time)".
    it.each`
      timeCode | definition
      ${"UT"}  | ${"Universal Time Coordinate"}
      ${"GM"}  | ${"Greenwich Mean Time"}
    `("reads $timeCode ($definition) as the offset +00:00", ({ timeCode }) => {
      expect(offsetMinutes("+00:00")).toBe(0);
      expect(x12TimeCode(timeCode)).toEqual({ offset: "+00:00" });
    });
  });

  describe("named daylight and standard codes: a zone name and a flag, no offset", () => {
    it.each`
      timeCode | definition                         | zone                 | daylight
      ${"AD"}  | ${"Alaska Daylight Time"}          | ${"Alaska"}          | ${true}
      ${"AS"}  | ${"Alaska Standard Time"}          | ${"Alaska"}          | ${false}
      ${"CD"}  | ${"Central Daylight Time"}         | ${"Central"}         | ${true}
      ${"CS"}  | ${"Central Standard Time"}         | ${"Central"}         | ${false}
      ${"ED"}  | ${"Eastern Daylight Time"}         | ${"Eastern"}         | ${true}
      ${"ES"}  | ${"Eastern Standard Time"}         | ${"Eastern"}         | ${false}
      ${"HD"}  | ${"Hawaii-Aleutian Daylight Time"} | ${"Hawaii-Aleutian"} | ${true}
      ${"HS"}  | ${"Hawaii-Aleutian Standard Time"} | ${"Hawaii-Aleutian"} | ${false}
      ${"MD"}  | ${"Mountain Daylight Time"}        | ${"Mountain"}        | ${true}
      ${"MS"}  | ${"Mountain Standard Time"}        | ${"Mountain"}        | ${false}
      ${"ND"}  | ${"Newfoundland Daylight Time"}    | ${"Newfoundland"}    | ${true}
      ${"NS"}  | ${"Newfoundland Standard Time"}    | ${"Newfoundland"}    | ${false}
      ${"PD"}  | ${"Pacific Daylight Time"}         | ${"Pacific"}         | ${true}
      ${"PS"}  | ${"Pacific Standard Time"}         | ${"Pacific"}         | ${false}
      ${"TD"}  | ${"Atlantic Daylight Time"}        | ${"Atlantic"}        | ${true}
      ${"TS"}  | ${"Atlantic Standard Time"}        | ${"Atlantic"}        | ${false}
    `(
      "reads $timeCode ($definition) as zone $zone, daylight $daylight",
      ({ timeCode, zone, daylight }) => {
        const meaning = x12TimeCode(timeCode);
        expect(meaning).toEqual({ zone, daylight });
        expect(meaning).not.toHaveProperty("offset");
      },
    );
  });

  describe("generic codes: a zone name that says neither standard nor daylight", () => {
    it.each`
      timeCode | definition                | zone
      ${"AT"}  | ${"Alaska Time"}          | ${"Alaska"}
      ${"CT"}  | ${"Central Time"}         | ${"Central"}
      ${"ET"}  | ${"Eastern Time"}         | ${"Eastern"}
      ${"HT"}  | ${"Hawaii-Aleutian Time"} | ${"Hawaii-Aleutian"}
      ${"MT"}  | ${"Mountain Time"}        | ${"Mountain"}
      ${"NT"}  | ${"Newfoundland Time"}    | ${"Newfoundland"}
      ${"PT"}  | ${"Pacific Time"}         | ${"Pacific"}
      ${"TT"}  | ${"Atlantic Time"}        | ${"Atlantic"}
      ${"LT"}  | ${"Local Time"}           | ${"Local"}
    `(
      "reads $timeCode ($definition) as zone $zone, daylight null",
      ({ timeCode, zone }) => {
        const meaning = x12TimeCode(timeCode);
        expect(meaning).toEqual({ zone, daylight: null });
        expect(meaning).not.toHaveProperty("offset");
      },
    );
  });

  // `test/x12TimeCodeMatrix.ts` holds the same 56 definitions as one typed table, shared with
  // the tests of `parseX12DateTime`. Each row of it is checked here against the function and,
  // for an offset code, against plain Temporal.
  it.each(
    X12_TIME_CODES.map((timeCode) => ({
      timeCode,
      expectation: X12_TIME_CODE_EXPECTATIONS[timeCode],
    })),
  )(
    "the shared table's row for $timeCode ($expectation.definition) is what x12TimeCode returns",
    ({ timeCode, expectation }) => {
      if ("minutes" in expectation) {
        expect(offsetMinutes(expectation.offset)).toBe(expectation.minutes);
        expect(x12TimeCode(timeCode)).toEqual({ offset: expectation.offset });
      } else {
        expect(x12TimeCode(timeCode)).toEqual({
          zone: expectation.zone,
          daylight: expectation.daylight,
        });
      }
    },
  );

  it("reads all 56 codes of data element 623, each as an offset or as a zone, never both", () => {
    const meanings = X12_TIME_CODES.map((timeCode) => x12TimeCode(timeCode));
    const offsets = meanings.filter(
      (meaning) => meaning !== null && "offset" in meaning,
    );
    const zones = meanings.filter(
      (meaning) => meaning !== null && "zone" in meaning,
    );
    // 29 numeric codes plus GM and UT state an offset; 16 paired, 8 generic and LT name a zone.
    expect(X12_TIME_CODES).toHaveLength(56);
    expect(offsets).toHaveLength(31);
    expect(zones).toHaveLength(25);
  });

  it.each`
    timeCode | first                                   | changed
    ${"01"}  | ${{ offset: "+01:00" }}                 | ${{ offset: "-09:00" }}
    ${"ES"}  | ${{ zone: "Eastern", daylight: false }} | ${{ zone: "Pacific", daylight: true }}
  `(
    "returns a fresh object for $timeCode: changing one result does not change the next",
    ({ timeCode, first, changed }) => {
      const meaning = x12TimeCode(timeCode);
      expect(meaning).toEqual(first);
      Object.assign(meaning as object, changed);
      expect(x12TimeCode(timeCode)).toEqual(first);
      expect(x12TimeCode(timeCode)).not.toBe(x12TimeCode(timeCode));
    },
  );

  it.each`
    timeCode       | reads
    ${"et"}        | ${"lower case: matching is exact"}
    ${" ET"}       | ${"a leading space"}
    ${"ET "}       | ${"a trailing space"}
    ${"1"}         | ${"one digit: the code is 01"}
    ${"001"}       | ${"three digits"}
    ${"00"}        | ${"below the numeric run"}
    ${"30"}        | ${"above the numeric run"}
    ${"EST"}       | ${"an abbreviation, not a 623 code"}
    ${"Z"}         | ${"the ISO 8601 UTC designator, not a 623 code"}
    ${"+01:00"}    | ${"an offset, not a code"}
    ${"UTC"}       | ${"UTC is UT in 623"}
    ${"ZZ"}        | ${"an unknown code"}
    ${""}          | ${"an empty string: a blank time code states nothing"}
    ${"toString"}  | ${"an inherited property name"}
    ${"__proto__"} | ${"an inherited property name"}
  `("returns null for $timeCode ($reads)", ({ timeCode }) => {
    expect(x12TimeCode(timeCode)).toBeNull();
  });

  // A non-string collapses to one path. 1 is the number a caller might pass for "01".
  it("returns null for a time code that is not a string", () => {
    const nonStrings: [string, unknown][] = [
      ["null", null],
      ["undefined", undefined],
      ["a number", 1],
      ["a boolean", true],
      ["an array holding a code", ["ET"]],
      ["an object", { ET: true }],
      ["a Proxy that throws on any trap", hostileProxy()],
      ["a revoked Proxy", revokedProxy()],
    ];
    for (const [kind, value] of nonStrings) {
      expect(x12TimeCode(value as never), kind).toBeNull();
    }
  });
});
