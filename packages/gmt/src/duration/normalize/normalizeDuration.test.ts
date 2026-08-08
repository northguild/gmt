import { normalizeDuration } from "./normalizeDuration";

describe("normalizeDuration", () => {
  it.each`
    value       | expected
    ${"PT90M"}  | ${"PT90M"}
    ${"PT36H"}  | ${"PT36H"}
    ${"PT0S"}   | ${"PT0S"}
    ${"P1D"}    | ${"P1D"}
    ${"-PT90M"} | ${"-PT90M"}
    ${"PT130S"} | ${"PT130S"}
  `(
    "defaults to largestUnit auto, reformatting $value to $expected",
    ({ value, expected }) => {
      expect(normalizeDuration(value)).toBe(expected);
    },
  );

  it.each`
    value       | largestUnit | expected
    ${"PT90M"}  | ${"hour"}   | ${"PT1H30M"}
    ${"PT90M"}  | ${"minute"} | ${"PT90M"}
    ${"P1DT2H"} | ${"day"}    | ${"P1DT2H"}
    ${"P1DT2H"} | ${"hour"}   | ${"PT26H"}
  `(
    "rebalances $value to $expected with largestUnit $largestUnit",
    ({ value, largestUnit, expected }) => {
      expect(normalizeDuration(value, { largestUnit })).toBe(expected);
    },
  );

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${"PT2M"}
    ${"floor"}      | ${"PT1M"}
    ${"trunc"}      | ${"PT1M"}
    ${"halfExpand"} | ${"PT2M"}
    ${"halfCeil"}   | ${"PT2M"}
    ${"halfFloor"}  | ${"PT1M"}
    ${"halfTrunc"}  | ${"PT1M"}
    ${"halfEven"}   | ${"PT2M"}
    ${"expand"}     | ${"PT2M"}
  `(
    "rounds PT1M30S to $expected with smallestUnit minute and roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        normalizeDuration("PT1M30S", { smallestUnit: "minute", roundingMode }),
      ).toBe(expected);
    },
  );

  it.each`
    value      | smallestUnit | roundingIncrement | expected
    ${"PT45M"} | ${"minute"}  | ${30}             | ${"PT60M"}
    ${"PT45M"} | ${"minute"}  | ${7}              | ${""}
    ${"PT45M"} | ${"hour"}    | ${1}              | ${"PT1H"}
    ${"P10D"}  | ${"day"}     | ${7}              | ${"P7D"}
  `(
    "applies roundingIncrement $roundingIncrement to $value with smallestUnit $smallestUnit -> $expected",
    ({ value, smallestUnit, roundingIncrement, expected }) => {
      expect(
        normalizeDuration(value, { smallestUnit, roundingIncrement }),
      ).toBe(expected);
    },
  );

  it("rebalances using smallestUnit alone, with no explicit largestUnit", () => {
    expect(normalizeDuration("PT90M30S", { smallestUnit: "minute" })).toBe(
      "PT91M",
    );
  });

  it.each`
    value     | smallestUnit | expected
    ${"PT1H"} | ${"hour"}    | ${"PT1H"}
    ${"P1D"}  | ${"day"}     | ${"P1D"}
  `(
    "smallestUnit $smallestUnit has no effect on $value, still succeeds as $expected",
    ({ value, smallestUnit, expected }) => {
      expect(normalizeDuration(value, { smallestUnit })).toBe(expected);
    },
  );

  it("falls back to the largestUnit auto default when only roundingMode is given", () => {
    expect(normalizeDuration("PT90M", { roundingMode: "ceil" })).toBe("PT90M");
  });

  it.each`
    value      | largestUnit | relativeTo      | expected
    ${"P45D"}  | ${"month"}  | ${undefined}    | ${""}
    ${"P45D"}  | ${"month"}  | ${"2024-01-01"} | ${"P1M14D"}
    ${"P400D"} | ${"year"}   | ${"2023-01-01"} | ${"P1Y1M4D"}
    ${"-P45D"} | ${"month"}  | ${"2024-01-01"} | ${"-P1M14D"}
  `(
    "rebalancing $value to largestUnit $largestUnit with relativeTo $relativeTo -> $expected",
    ({ value, largestUnit, relativeTo, expected }) => {
      expect(normalizeDuration(value, { largestUnit, relativeTo })).toBe(
        expected,
      );
    },
  );

  it.each`
    value    | options                                             | expected
    ${"P1M"} | ${{}}                                               | ${""}
    ${"P1M"} | ${{ largestUnit: "day" }}                           | ${""}
    ${"P1M"} | ${{ largestUnit: "day", relativeTo: "2024-01-01" }} | ${"P31D"}
  `(
    "input with a calendar unit requires relativeTo even under default auto: $value with $options -> $expected",
    ({ value, options, expected }) => {
      expect(normalizeDuration(value, options)).toBe(expected);
    },
  );

  it("returns an empty string for an invalid relativeTo", () => {
    expect(
      normalizeDuration("P45D", {
        largestUnit: "month",
        relativeTo: "not-a-date",
      }),
    ).toBe("");
  });

  it.each`
    invalidValue
    ${"not a duration"}
    ${""}
  `(
    "returns an empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(normalizeDuration(invalidValue)).toBe("");
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${5}
    ${true}
    ${false}
    ${["PT1H"]}
    ${{}}
    ${{ days: 1 }}
  `("returns an empty string for non-string input $value", ({ value }) => {
    expect(normalizeDuration(value as never)).toBe("");
  });
});
