import { subtractDuration } from "./subtractDuration";

describe("subtractDuration", () => {
  it.each`
    a           | b           | expected
    ${"P1D"}    | ${"PT2H"}   | ${"PT22H"}
    ${"PT0S"}   | ${"PT0S"}   | ${"PT0S"}
    ${"PT1H"}   | ${"PT2H"}   | ${"-PT1H"}
    ${"PT1.5S"} | ${"PT0.5S"} | ${"PT1S"}
    ${"-P1D"}   | ${"-PT2H"}  | ${"-PT22H"}
  `("returns $expected for $a - $b", ({ a, b, expected }) => {
    expect(subtractDuration(a, b)).toBe(expected);
  });

  it.each`
    a        | b
    ${"P1Y"} | ${"P1M"}
    ${"P1W"} | ${"P1D"}
    ${"P1D"} | ${"P1Y"}
  `(
    'returns "" when combining calendar-unit durations $a - $b (no relativeTo)',
    ({ a, b }) => {
      expect(subtractDuration(a, b)).toBe("");
    },
  );

  it.each`
    a                   | b
    ${"not a duration"} | ${"P1D"}
    ${"P1D"}            | ${"not a duration"}
    ${""}               | ${"P1D"}
    ${"P1D"}            | ${""}
  `('returns "" when either operand is invalid: $a - $b', ({ a, b }) => {
    expect(subtractDuration(a, b)).toBe("");
  });
});
