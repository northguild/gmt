import { parseDuration } from "./parseDuration";

describe("parseDuration", () => {
  it.each`
    value               | expected
    ${"P1D"}            | ${"P1D"}
    ${"PT2H30M"}        | ${"PT2H30M"}
    ${"P1DT2H30M"}      | ${"P1DT2H30M"}
    ${"P1Y2M"}          | ${"P1Y2M"}
    ${"P2W"}            | ${"P2W"}
    ${"PT0S"}           | ${"PT0S"}
    ${"-P1D"}           | ${"-P1D"}
    ${"-PT1.5S"}        | ${"-PT1.5S"}
    ${"PT1.5S"}         | ${"PT1.5S"}
    ${"P"}              | ${""}
    ${""}               | ${""}
    ${"not a duration"} | ${""}
    ${"P1DT-2H"}        | ${""}
  `("normalizes $value to $expected", ({ value, expected }) => {
    expect(parseDuration(value)).toBe(expected);
  });

  it.each`
    duration            | smallestUnit     | expected
    ${"P1D"}            | ${"second"}      | ${"P1DT0S"}
    ${"PT1.5S"}         | ${"second"}      | ${"PT1S"}
    ${"-PT1.5S"}        | ${"second"}      | ${"-PT1S"}
    ${"PT1.123456789S"} | ${"second"}      | ${"PT1S"}
    ${"PT1.123456789S"} | ${"millisecond"} | ${"PT1.123S"}
    ${"PT1.123456789S"} | ${"microsecond"} | ${"PT1.123456S"}
    ${"PT1.123456789S"} | ${"nanosecond"}  | ${"PT1.123456789S"}
    ${"PT0S"}           | ${"second"}      | ${"PT0S"}
    ${"PT0S"}           | ${"millisecond"} | ${"PT0.000S"}
  `(
    "rounds $duration to $expected with smallestUnit $smallestUnit",
    ({ duration, smallestUnit, expected }) => {
      expect(parseDuration(duration, { smallestUnit })).toBe(expected);
    },
  );

  it.each`
    smallestUnit
    ${"minute"}
    ${"hour"}
    ${"minutes"}
    ${"hours"}
  `(
    "returns an empty string when smallestUnit $smallestUnit is rejected by Temporal (only sub-second units are valid)",
    ({ smallestUnit }) => {
      expect(parseDuration("PT1.5S", { smallestUnit })).toBe("");
    },
  );

  it.each`
    fractionalSecondDigits | expected
    ${"auto"}              | ${"PT1.5S"}
    ${0}                   | ${"PT1S"}
    ${1}                   | ${"PT1.5S"}
    ${2}                   | ${"PT1.50S"}
    ${3}                   | ${"PT1.500S"}
    ${4}                   | ${"PT1.5000S"}
    ${5}                   | ${"PT1.50000S"}
    ${6}                   | ${"PT1.500000S"}
    ${7}                   | ${"PT1.5000000S"}
    ${8}                   | ${"PT1.50000000S"}
    ${9}                   | ${"PT1.500000000S"}
  `(
    "renders PT1.5S with fractionalSecondDigits $fractionalSecondDigits as $expected",
    ({ fractionalSecondDigits, expected }) => {
      expect(parseDuration("PT1.5S", { fractionalSecondDigits })).toBe(
        expected,
      );
    },
  );

  it("pads a whole-second duration with fractionalSecondDigits", () => {
    expect(parseDuration("PT0S", { fractionalSecondDigits: 3 })).toBe(
      "PT0.000S",
    );
  });

  it.each`
    value        | roundingMode    | expected
    ${"PT1.5S"}  | ${"ceil"}       | ${"PT2S"}
    ${"PT1.5S"}  | ${"floor"}      | ${"PT1S"}
    ${"PT1.5S"}  | ${"trunc"}      | ${"PT1S"}
    ${"PT1.5S"}  | ${"halfExpand"} | ${"PT2S"}
    ${"-PT1.5S"} | ${"ceil"}       | ${"-PT1S"}
    ${"-PT1.5S"} | ${"floor"}      | ${"-PT2S"}
    ${"-PT1.5S"} | ${"trunc"}      | ${"-PT1S"}
    ${"-PT1.5S"} | ${"halfExpand"} | ${"-PT2S"}
  `(
    "rounds $value to $expected with smallestUnit second and roundingMode $roundingMode",
    ({ value, roundingMode, expected }) => {
      expect(
        parseDuration(value, { smallestUnit: "second", roundingMode }),
      ).toBe(expected);
    },
  );

  it("prefers smallestUnit over fractionalSecondDigits when both are provided", () => {
    expect(
      parseDuration("PT1.5S", {
        smallestUnit: "second",
        fractionalSecondDigits: 3,
      }),
    ).toBe("PT1S");
  });

  it.each`
    invalidValue
    ${"P"}
    ${""}
    ${"not a duration"}
    ${"P1DT-2H"}
  `(
    "returns an empty string for invalid value $invalidValue even when options are provided",
    ({ invalidValue }) => {
      expect(
        parseDuration(invalidValue, {
          smallestUnit: "second",
          roundingMode: "halfExpand",
        }),
      ).toBe("");
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${5}
    ${true}
    ${false}
    ${["P1D"]}
    ${{}}
    ${{ days: 1 }}
  `("returns an empty string for non-string input $value", ({ value }) => {
    expect(parseDuration(value as never)).toBe("");
  });
});
