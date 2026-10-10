import { Temporal } from "@js-temporal/polyfill";
import { X12_TIME_CODES } from "../../internal";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { X12_TIME_CODE_EXPECTATIONS } from "../../test/x12TimeCodeMatrix";
import type {
  X12OffsetTimeCode,
  X12TimeCode,
  X12ZoneTimeCode,
} from "../../types/edi";
import { x12TimeCodeOffset } from "./x12TimeCodeOffset";
import { x12TimeCodeZone } from "./x12TimeCodeZone";

/**
 * Every expected value is read off the X12 data element 623 code list (release 008010, Stedi's
 * X12-licensed dictionary; `25`–`29` were added in release 006010): the `designator` column is
 * the definition's own text after "Equivalent to ISO", where `P` is plus and `M` is minus.
 * `minutes` is that designator worked out by hand as signed minutes from UTC, and each row
 * checks the expected offset string against it through plain Temporal, so a wrong sign or a
 * wrong hour in either column fails.
 */
function offsetMinutes(offset: string): number {
  return (
    Temporal.Instant.from("2024-01-01T00:00:00Z").toZonedDateTimeISO(offset)
      .offsetNanoseconds / 60_000_000_000
  );
}

// The two subsets are the whole list and share no code: each assignment fails typecheck if a
// code is in neither union, or in a union and not in `X12TimeCode`.
const everyCode: X12OffsetTimeCode | X12ZoneTimeCode = "01" as X12TimeCode;
const everyCodeBack: X12TimeCode = everyCode;
const noSharedCode: Extract<X12OffsetTimeCode, X12ZoneTimeCode> extends never
  ? true
  : false = true;

describe("x12TimeCodeOffset", () => {
  it("the offset codes and the zone codes are the 56 time codes, with none in both", () => {
    expect(everyCodeBack).toBe("01");
    expect(noSharedCode).toBe(true);
  });

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
        expect(x12TimeCodeOffset(timeCode)).toBe(offset);
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
        expect(x12TimeCodeOffset(timeCode)).toBe(offset);
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
        expect(x12TimeCodeOffset(timeCode)).toBe(offset);
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
      expect(x12TimeCodeOffset(timeCode)).toBe("+00:00");
    });
  });

  describe("the 56-code list", () => {
    const rows = X12_TIME_CODES.map((timeCode) => ({
      timeCode,
      ...X12_TIME_CODE_EXPECTATIONS[timeCode],
    }));

    it.each(rows.filter((row) => "offset" in row))(
      "$timeCode ($definition) is the offset $offset, and names no zone",
      (row) => {
        const offset = "offset" in row ? row.offset : "";
        expect(x12TimeCodeOffset(row.timeCode as never)).toBe(offset);
        expect(x12TimeCodeZone(row.timeCode as never)).toBeNull();
      },
    );

    // X12 states no offset for a named code, and GMT holds no table of zone offsets.
    it.each(rows.filter((row) => "zone" in row))(
      "$timeCode ($definition) states no offset: ''",
      ({ timeCode }) => {
        expect(x12TimeCodeOffset(timeCode as never)).toBe("");
      },
    );

    it("31 codes state an offset and 25 name a zone", () => {
      expect(rows.filter((row) => "offset" in row)).toHaveLength(31);
      expect(rows.filter((row) => "zone" in row)).toHaveLength(25);
      expect(
        X12_TIME_CODES.filter(
          (code) => x12TimeCodeOffset(code as never) !== "",
        ),
      ).toHaveLength(31);
    });
  });

  // Membership is by the list, never by shape, and matching is exact.
  it.each`
    timeCode         | reads
    ${"et"}          | ${"lower case: matching is exact"}
    ${"ut"}          | ${"lower case"}
    ${" UT"}         | ${"a leading space"}
    ${"UT "}         | ${"a trailing space"}
    ${"1"}           | ${"one digit: the code is 01"}
    ${"001"}         | ${"three digits"}
    ${"00"}          | ${"below the numeric run"}
    ${"30"}          | ${"above the numeric run"}
    ${"EST"}         | ${"an abbreviation, not a 623 code"}
    ${"Z"}           | ${"the ISO 8601 UTC designator"}
    ${"UTC"}         | ${"UTC is UT in 623"}
    ${"GMT"}         | ${"GMT is GM in 623"}
    ${"+01:00"}      | ${"an offset, not a code"}
    ${"DT"}          | ${"a 1250 format code, not a 623 time code"}
    ${""}            | ${"an empty string"}
    ${"toString"}    | ${"an inherited property name"}
    ${"constructor"} | ${"an inherited property name"}
    ${"__proto__"}   | ${"an inherited property name"}
  `("returns '' for '$timeCode' ($reads)", ({ timeCode }) => {
    expect(x12TimeCodeOffset(timeCode)).toBe("");
  });

  it("returns '' for a time code that is not a string", () => {
    const nonStrings: [string, () => unknown][] = [
      ["null", () => null],
      ["undefined", () => undefined],
      ["a number", () => 1],
      ["a boolean", () => true],
      ["an array holding a code", () => ["UT"]],
      ["an object", () => ({ UT: true })],
      ["a Proxy that throws on any trap", hostileProxy],
      ["a revoked Proxy", revokedProxy],
    ];
    for (const [kind, make] of nonStrings) {
      expect(x12TimeCodeOffset(make() as never), kind).toBe("");
    }
  });
});
