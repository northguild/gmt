import { Temporal } from "../../internal/temporal";
import { CCSDS_ASCII_CASES } from "../../test/ccsdsAsciiCases";
import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import type { FractionalDigit } from "../../types";
import { parseCcsdsAsciiA } from "../parse/parseCcsdsAsciiA";
import { parseCcsdsAsciiB } from "../parse/parseCcsdsAsciiB";
import { formatCcsdsAsciiB } from "./formatCcsdsAsciiB";

describe("formatCcsdsAsciiB", () => {
  // CCSDS 301.0-B-4 §3.5.1.2; DDD is Temporal's dayOfYear of the UTC date.
  it.each`
    isoString                           | digits       | expected                          | why
    ${"1988-01-18T17:20:43.123456Z"}    | ${undefined} | ${"1988-018T17:20:43.123456Z"}    | ${"§3.5.1.2 example"}
    ${"1988-01-18T17:20:43.123456Z"}    | ${6}         | ${"1988-018T17:20:43.123456Z"}    | ${"six digits"}
    ${"1988-01-18T17:20:43.123456Z"}    | ${9}         | ${"1988-018T17:20:43.123456000Z"} | ${"fixed width"}
    ${"1988-01-18T17:20:43.123456Z"}    | ${0}         | ${"1988-018T17:20:43Z"}           | ${"no period"}
    ${"1988-01-18T17:20:43.123456Z"}    | ${3.5}       | ${"1988-018T17:20:43.123Z"}       | ${"Temporal floors a number"}
    ${"1988-01-18T17:20:43.123456Z"}    | ${"auto"}    | ${"1988-018T17:20:43.123456Z"}    | ${"auto is the shortest"}
    ${"2024-01-01T00:00:00Z"}           | ${undefined} | ${"2024-001T00:00:00Z"}           | ${"first day, padded to 3"}
    ${"2024-02-29T12:00:00Z"}           | ${undefined} | ${"2024-060T12:00:00Z"}           | ${"leap day"}
    ${"2024-03-01T00:00:00Z"}           | ${undefined} | ${"2024-061T00:00:00Z"}           | ${"day after leap day"}
    ${"2023-03-01T00:00:00Z"}           | ${undefined} | ${"2023-060T00:00:00Z"}           | ${"common year"}
    ${"2024-06-15T10:30:00Z"}           | ${undefined} | ${"2024-167T10:30:00Z"}           | ${"day 167"}
    ${"2024-12-31T23:59:59Z"}           | ${undefined} | ${"2024-366T23:59:59Z"}           | ${"day 366"}
    ${"2023-12-31T23:59:59Z"}           | ${undefined} | ${"2023-365T23:59:59Z"}           | ${"day 365"}
    ${"2024-01-01T01:00:00+02:00"}      | ${undefined} | ${"2023-365T23:00:00Z"}           | ${"UTC day in the year before"}
    ${"2025-01-01T00:59:59+01:00"}      | ${undefined} | ${"2024-366T23:59:59Z"}           | ${"UTC day 366"}
    ${"2024-12-31T23:59:59.9999999Z"}   | ${3}         | ${"2024-366T23:59:59.999Z"}       | ${"cut, never into next year"}
    ${"1972-06-30T23:59:60Z"}           | ${undefined} | ${"1972-182T23:59:60Z"}           | ${"first inserted leap second"}
    ${"2015-06-30T23:59:60Z"}           | ${undefined} | ${"2015-181T23:59:60Z"}           | ${"leap second, common year"}
    ${"2016-12-31T23:59:60.25Z"}        | ${1}         | ${"2016-366T23:59:60.2Z"}         | ${"cut inside the leap second"}
    ${"2017-01-01T08:59:60+09:00"}      | ${undefined} | ${"2016-366T23:59:60Z"}           | ${"leap second given in an offset"}
    ${"1969-12-31T23:59:59.5Z"}         | ${undefined} | ${"1969-365T23:59:59.5Z"}         | ${"before the Unix epoch"}
    ${"0001-01-01T00:00:00Z"}           | ${undefined} | ${"0001-001T00:00:00Z"}           | ${"lowest year"}
    ${"9999-12-31T23:59:59.999999999Z"} | ${undefined} | ${"9999-365T23:59:59.999999999Z"} | ${"highest instant"}
  `(
    "returns '$expected' for '$isoString' with digits $digits ($why)",
    ({ isoString, digits, expected }) => {
      expect(formatCcsdsAsciiB(isoString, digits)).toBe(expected);
    },
  );

  it.each`
    isoString                      | why
    ${"2024-06-15T10:30:00"}       | ${"no offset: a local time"}
    ${"2024-167T10:30:00Z"}        | ${"Code B text is not an ISO instant"}
    ${"2017-12-31T23:59:60Z"}      | ${"no insertion that day"}
    ${"2016-12-31T12:00:60Z"}      | ${"a leap second is only at 23:59:60 UTC"}
    ${"0001-01-01T00:30:00+01:00"} | ${"UTC year 0"}
    ${"9999-12-31T23:30:00-01:00"} | ${"UTC year 10000"}
    ${""}                          | ${"empty"}
  `("returns an empty string for '$isoString' ($why)", ({ isoString }) => {
    expect(formatCcsdsAsciiB(isoString)).toBe("");
  });

  it.each`
    label     | digits
    ${"10"}   | ${10}
    ${"-1"}   | ${-1}
    ${"NaN"}  | ${Number.NaN}
    ${"null"} | ${null}
    ${'"3"'}  | ${"3"}
    ${"true"} | ${true}
  `("returns an empty string for digits $label", ({ digits }) => {
    expect(
      formatCcsdsAsciiB("2024-06-15T10:30:00Z", digits as FractionalDigit),
    ).toBe("");
  });

  it.each`
    value        | why
    ${undefined} | ${"undefined"}
    ${null}      | ${"null"}
    ${20240615}  | ${"a number"}
    ${{}}        | ${"an object"}
  `("returns an empty string for non-string $why", ({ value }) => {
    expect(formatCcsdsAsciiB(value as unknown as string)).toBe("");
  });

  it("returns an empty string for a hostile proxy", () => {
    expect(formatCcsdsAsciiB(hostileProxy() as string)).toBe("");
  });

  it("returns an empty string for a revoked proxy", () => {
    expect(formatCcsdsAsciiB(revokedProxy() as string)).toBe("");
  });

  it.each(
    CCSDS_ASCII_CASES.map((row) => ({
      instant: row.instant,
      digits: row.digits as FractionalDigit,
      codeB: row.codeB,
      why: row.why,
    })),
  )(
    "writes '$codeB' from the shared row '$instant' with digits $digits ($why)",
    ({ instant, digits, codeB }) => {
      expect(formatCcsdsAsciiB(instant, digits)).toBe(codeB);
    },
  );

  // Index Verification: parse then format with the row's digits is the identity.
  it.each(
    CCSDS_ASCII_CASES.map((row) => ({
      codeB: row.codeB,
      digits: row.digits as FractionalDigit,
    })),
  )(
    "round trip: formats the parse of '$codeB' with $digits digits back to '$codeB'",
    ({ codeB, digits }) => {
      expect(formatCcsdsAsciiB(parseCcsdsAsciiB(codeB), digits)).toBe(codeB);
    },
  );

  // Index Verification: the A and B forms of one row are the same instant.
  it.each(
    CCSDS_ASCII_CASES.map((row) => ({
      codeA: row.codeA,
      codeB: row.codeB,
      instant: row.instant,
    })),
  )(
    "parses '$codeA' and '$codeB' to the same instant '$instant'",
    ({ codeA, codeB, instant }) => {
      expect(parseCcsdsAsciiA(codeA)).toBe(instant);
      expect(parseCcsdsAsciiB(codeB)).toBe(instant);
    },
  );

  it("writes the day of year Temporal reports for every day of 2023 and 2024", () => {
    const mismatches: string[] = [];
    for (const year of [2023, 2024]) {
      let date = Temporal.PlainDate.from({ year, month: 1, day: 1 });
      while (date.year === year) {
        const expected = `${year}-${String(date.dayOfYear).padStart(3, "0")}T12:00:00Z`;
        const actual = formatCcsdsAsciiB(`${date.toString()}T12:00:00Z`);
        const instant = `${date.toString()}T12:00:00Z`;
        if (actual !== expected || parseCcsdsAsciiB(actual) !== instant) {
          mismatches.push(`${date.toString()}: ${actual}`);
        }
        date = date.add({ days: 1 });
      }
    }
    expect(mismatches).toEqual([]);
  });
});
