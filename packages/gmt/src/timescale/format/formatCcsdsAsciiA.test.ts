import type { FractionalDigit } from "../../types";
import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import { CCSDS_ASCII_CASES } from "../../test/ccsdsAsciiCases";
import { NON_STRINGS } from "../../test/nonStrings";
import { parseCcsdsAsciiA } from "../parse/parseCcsdsAsciiA";
import { formatCcsdsAsciiA } from "./formatCcsdsAsciiA";

const asDigits = (value: unknown): FractionalDigit =>
  value as unknown as FractionalDigit;

/**
 * Expected values are decided from CCSDS 301.0-B-4 §3.5.1.1 (Code A, UTC, year 0001-9999),
 * §3.5.1.3 c) (no fraction drops the period), ITU-R TF.460-6 Annex 1 §2.2 (second 60 only in an
 * inserted second) and Temporal's `toString` (`fractionalSecondDigits`, cut with `trunc`).
 * Ordinary rows were checked against the polyfill; second 60 cannot be, since Temporal clamps it.
 */
describe("formatCcsdsAsciiA", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("accepted", () => {
    it.each`
      isoString                                    | digits       | expected                            | why
      ${"2024-06-15T12:30:00.123456789+02:00"}     | ${6}         | ${"2024-06-15T10:30:00.123456Z"}    | ${"to UTC, cut to 6"}
      ${"2024-06-15T12:30:00.123456789+02:00"}     | ${undefined} | ${"2024-06-15T10:30:00.123456789Z"} | ${"explicit undefined is the default"}
      ${"2024-06-15T12:30:00.123456789+02:00"}     | ${"auto"}    | ${"2024-06-15T10:30:00.123456789Z"} | ${"auto keeps every nanosecond"}
      ${"2024-06-15T12:30:00.123456789+02:00"}     | ${0}         | ${"2024-06-15T10:30:00Z"}           | ${"no period, §3.5.1.3 c"}
      ${"2024-06-15T12:30:00.123456789+02:00"}     | ${3.5}       | ${"2024-06-15T10:30:00.123Z"}       | ${"Temporal floors a number"}
      ${"2024-06-15T10:30:00Z"}                    | ${"auto"}    | ${"2024-06-15T10:30:00Z"}           | ${"auto of zero nanoseconds"}
      ${"2024-06-15T10:30:00Z"}                    | ${3}         | ${"2024-06-15T10:30:00.000Z"}       | ${"fixed width"}
      ${"2024-06-15T10:30:00.5Z"}                  | ${9}         | ${"2024-06-15T10:30:00.500000000Z"} | ${"padded to nine"}
      ${"2024-06-15T10:30:00,5Z"}                  | ${"auto"}    | ${"2024-06-15T10:30:00.5Z"}         | ${"comma read, period written"}
      ${"2024-06-15T12:30:00+02:00[Europe/Paris]"} | ${"auto"}    | ${"2024-06-15T10:30:00Z"}           | ${"bracketed zone read, not written"}
      ${"2024-06-15T23:59:59.999Z"}                | ${0}         | ${"2024-06-15T23:59:59Z"}           | ${"cut, never into the next day"}
      ${"2024-12-31T23:59:59.9999999Z"}            | ${3}         | ${"2024-12-31T23:59:59.999Z"}       | ${"cut, never into the next year"}
      ${"1969-12-31T23:59:59.5Z"}                  | ${"auto"}    | ${"1969-12-31T23:59:59.5Z"}         | ${"before the Unix epoch"}
      ${"0001-01-01T00:00:00.000000001Z"}          | ${9}         | ${"0001-01-01T00:00:00.000000001Z"} | ${"lowest year"}
      ${"9999-12-31T23:59:59.999999999Z"}          | ${"auto"}    | ${"9999-12-31T23:59:59.999999999Z"} | ${"highest instant"}
      ${"2024-01-01T01:00:00+02:00"}               | ${"auto"}    | ${"2023-12-31T23:00:00Z"}           | ${"offset crosses the year"}
    `(
      "writes '$isoString' with digits $digits ($why)",
      ({ isoString, digits, expected }) => {
        expect(formatCcsdsAsciiA(isoString, digits)).toBe(expected);
      },
    );

    it("writes the default fraction when digits is omitted", () => {
      expect(formatCcsdsAsciiA("2024-06-15T12:30:00.123456789+02:00")).toBe(
        "2024-06-15T10:30:00.123456789Z",
      );
    });
  });

  describe("leap seconds", () => {
    it.each`
      isoString                           | digits    | expected                      | why
      ${"2016-12-31T23:59:60Z"}           | ${"auto"} | ${"2016-12-31T23:59:60Z"}     | ${"inserted second"}
      ${"2016-12-31T23:59:60.5Z"}         | ${3}      | ${"2016-12-31T23:59:60.500Z"} | ${"inserted second with a fraction"}
      ${"2016-12-31T23:59:60.999999999Z"} | ${0}      | ${"2016-12-31T23:59:60Z"}     | ${"cut stays inside the leap second"}
      ${"2017-01-01T08:59:60+09:00"}      | ${"auto"} | ${"2016-12-31T23:59:60Z"}     | ${"leap second given in an offset"}
    `(
      "writes '$isoString' with digits $digits ($why)",
      ({ isoString, digits, expected }) => {
        expect(formatCcsdsAsciiA(isoString, digits)).toBe(expected);
      },
    );
  });

  describe("refused", () => {
    it.each`
      isoString                      | why
      ${"2024-06-15T10:30:00"}       | ${"no offset: a local time, not an instant"}
      ${"2024-06-15"}                | ${"a date"}
      ${"2017-12-31T23:59:60Z"}      | ${"no insertion that day"}
      ${"2016-12-31T12:00:60Z"}      | ${"a leap second is only at 23:59:60 UTC"}
      ${"1971-12-31T23:59:60Z"}      | ${"before 1972"}
      ${"0000-12-31T23:00:00Z"}      | ${"UTC year 0, §3.5.1.1"}
      ${"0001-01-01T00:30:00+01:00"} | ${"UTC is 0000-12-31T23:30"}
      ${"9999-12-31T23:30:00-01:00"} | ${"UTC is 10000-01-01T00:30"}
      ${"+010000-01-01T00:00:00Z"}   | ${"year 10000"}
      ${"20240615"}                  | ${"not an instant string"}
      ${""}                          | ${"empty string"}
    `("returns '' for '$isoString' ($why)", ({ isoString }) => {
      expect(formatCcsdsAsciiA(isoString)).toBe("");
    });

    it.each`
      label         | digits
      ${"10"}       | ${10}
      ${"-1"}       | ${-1}
      ${"NaN"}      | ${Number.NaN}
      ${"Infinity"} | ${Number.POSITIVE_INFINITY}
      ${"null"}     | ${null}
      ${'"3"'}      | ${"3"}
      ${'"AUTO"'}   | ${"AUTO"}
      ${"true"}     | ${true}
    `("returns '' for a valid instant with digits $label", ({ digits }) => {
      expect(formatCcsdsAsciiA("2024-06-15T10:30:00Z", asDigits(digits))).toBe(
        "",
      );
    });

    it("returns '' for a value that is not a string", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(formatCcsdsAsciiA(make() as string), kind).toBe("");
      }
    });

    it("returns '' when Temporal throws", () => {
      mockTemporalInstantFromEpochNanosecondsThrow();
      expect(formatCcsdsAsciiA("2024-06-15T10:30:00Z")).toBe("");
    });
  });

  describe("shared rows", () => {
    it.each(
      CCSDS_ASCII_CASES.map(({ instant, digits, codeA }) => ({
        instant,
        digits,
        codeA,
      })),
    )(
      "writes '$instant' with $digits digits as '$codeA'",
      ({ instant, digits, codeA }) => {
        expect(formatCcsdsAsciiA(instant, asDigits(digits))).toBe(codeA);
      },
    );

    // CCSDS 301.0-B-4 §3.5.1.1; index Verification: parse then format with the row's digits is the identity.
    it.each(CCSDS_ASCII_CASES.map(({ codeA, digits }) => ({ codeA, digits })))(
      "round trip: formats the parse of '$codeA' with $digits digits back to '$codeA'",
      ({ codeA, digits }) => {
        expect(
          formatCcsdsAsciiA(parseCcsdsAsciiA(codeA), asDigits(digits)),
        ).toBe(codeA);
      },
    );
  });
});
