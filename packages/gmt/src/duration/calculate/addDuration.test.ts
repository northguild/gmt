import { addDuration } from "./addDuration";

describe("addDuration", () => {
  it.each`
    a           | b           | expected
    ${"P1D"}    | ${"PT2H"}   | ${"P1DT2H"}
    ${"PT0S"}   | ${"PT0S"}   | ${"PT0S"}
    ${"PT1.5S"} | ${"PT1.5S"} | ${"PT3S"}
    ${"-P1D"}   | ${"PT2H"}   | ${"-PT22H"}
    ${"PT1H"}   | ${"-PT2H"}  | ${"-PT1H"}
    ${"PT30M"}  | ${"PT45M"}  | ${"PT75M"}
    ${"P1D"}    | ${"P1D"}    | ${"P2D"}
    ${"P1DT1H"} | ${"PT23H"}  | ${"P2D"}
    ${"PT0.1S"} | ${"PT0.2S"} | ${"PT0.3S"}
    ${"-P1D"}   | ${"-PT2H"}  | ${"-P1DT2H"}
    ${"P0D"}    | ${"P0D"}    | ${"PT0S"}
    ${"PT1M"}   | ${"-PT1M"}  | ${"PT0S"}
  `("returns $expected for $a + $b", ({ a, b, expected }) => {
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
    ${"P1D"}            | ${"not a duration"}
    ${""}               | ${"P1D"}
    ${"P1D"}            | ${""}
  `('returns "" when either operand is invalid: $a + $b', ({ a, b }) => {
    expect(addDuration(a, b)).toBe("");
  });
});
