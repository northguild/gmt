import { isValidDuration } from "./isValidDuration";

describe("isValidDuration", () => {
  it.each`
    value                 | expected
    ${"P1D"}              | ${true}
    ${"PT1H"}             | ${true}
    ${"PT1M"}             | ${true}
    ${"PT1S"}             | ${true}
    ${"PT90M"}            | ${true}
    ${"P1DT1H"}           | ${true}
    ${"P1Y"}              | ${true}
    ${"P1M"}              | ${true}
    ${"P1W"}              | ${true}
    ${"P1Y2M3W4DT5H6M7S"} | ${true}
    ${"P1DT2H30M"}        | ${true}
    ${"P1Y2M"}            | ${true}
    ${"PT2H30M"}          | ${true}
  `("returns $expected for valid duration $value", ({ value, expected }) => {
    expect(isValidDuration(value)).toBe(expected);
  });

  it.each`
    value                 | expected
    ${"P0D"}              | ${true}
    ${"PT0S"}             | ${true}
    ${"P0Y0M0W0DT0H0M0S"} | ${true}
  `(
    "returns $expected for zero-value duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value                | expected
    ${"-P1D"}            | ${true}
    ${"-P1Y2M3DT4H5M6S"} | ${true}
    ${"+P1D"}            | ${true}
    ${"P1DT-2H"}         | ${false}
  `("returns $expected for signed duration $value", ({ value, expected }) => {
    expect(isValidDuration(value)).toBe(expected);
  });

  it.each`
    value               | expected
    ${"PT1.5H"}         | ${true}
    ${"PT1.5M"}         | ${true}
    ${"PT1.5S"}         | ${true}
    ${"PT1.123456789S"} | ${true}
  `(
    "returns $expected for fractional smallest-unit duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value           | expected
    ${"P1.5Y"}      | ${false}
    ${"P1.5M"}      | ${false}
    ${"P1.5W"}      | ${false}
    ${"P1.5D"}      | ${false}
    ${"PT1.5H2M"}   | ${false}
    ${"P1DT1.5H2M"} | ${false}
  `(
    "returns $expected for invalid fractional-unit duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value     | expected
    ${"p1d"}  | ${true}
    ${"P1d"}  | ${true}
    ${"p1D"}  | ${true}
    ${"pt1h"} | ${true}
  `(
    "returns $expected for lowercase-designator duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value               | expected
    ${"P1"}             | ${false}
    ${"PT"}             | ${false}
    ${"P1DT"}           | ${false}
    ${"1D"}             | ${false}
    ${"PD"}             | ${false}
    ${"P1D2H"}          | ${false}
    ${"P"}              | ${false}
    ${""}               | ${false}
    ${"not a duration"} | ${false}
  `(
    "returns $expected for malformed duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value     | expected
    ${" P1D"} | ${false}
    ${"P1D "} | ${false}
    ${"P 1D"} | ${false}
  `(
    "returns $expected for whitespace-containing duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
    },
  );

  it.each`
    value                       | expected
    ${"P999999999D"}            | ${true}
    ${"P99999999999999999999D"} | ${false}
  `(
    "returns $expected for extreme-magnitude duration $value",
    ({ value, expected }) => {
      expect(isValidDuration(value)).toBe(expected);
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
  `("returns false for non-string input $value", ({ value }) => {
    expect(isValidDuration(value as never)).toBe(false);
  });
});
