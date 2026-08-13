import { addDuration } from "./addDuration";

describe("addDuration", () => {
  it.each`
    a           | b          | expected
    ${"P1D"}    | ${"PT1H"}  | ${"P1DT1H"}
    ${"PT1S"}   | ${"PT1S"}  | ${"PT2S"}
    ${"P1DT1H"} | ${"P1D"}   | ${"P2DT1H"}
    ${"P1D"}    | ${"P1D"}   | ${"P2D"}
    ${"PT1M"}   | ${"PT90M"} | ${"PT91M"}
    ${"PT0S"}   | ${"PT0S"}  | ${"PT0S"}
    ${"PT1H"}   | ${"-PT1H"} | ${"PT0S"}
    ${"PT1H"}   | ${"-PT2H"} | ${"-PT1H"}
    ${"-P1D"}   | ${"-PT1H"} | ${"-P1DT1H"}
    ${"-P1D"}   | ${"PT1H"}  | ${"-PT23H"}
    ${"P1D"}    | ${"-PT1H"} | ${"PT23H"}
  `("returns $expected when adding $b to $a", ({ a, b, expected }) => {
    expect(addDuration(a, b)).toBe(expected);
  });

  it.each`
    a        | b
    ${"P1Y"} | ${"P1M"}
    ${"P1W"} | ${"P1D"}
    ${"P1D"} | ${"P1Y"}
  `(
    'returns "" when combining calendar-unit durations $a + $b (no relativeTo)',
    ({ a, b }) => {
      expect(addDuration(a, b)).toBe("");
    },
  );

  it.each`
    a                   | b
    ${"not a duration"} | ${"P1D"}
    ${""}               | ${"P1D"}
  `('returns "" when either operand is invalid: $a + $b', ({ a, b }) => {
    expect(addDuration(a, b)).toBe("");
  });
});
