import { negateDuration } from "./negateDuration";

describe("negateDuration", () => {
  it.each`
    value             | expected
    ${"P1DT2H"}       | ${"-P1DT2H"}
    ${"PT90M"}        | ${"-PT90M"}
    ${"P1Y2M3W4DT5H"} | ${"-P1Y2M3W4DT5H"}
    ${"P400D"}        | ${"-P400D"}
    ${"PT1.5S"}       | ${"-PT1.5S"}
  `("negates positive $value to $expected", ({ value, expected }) => {
    expect(negateDuration(value)).toBe(expected);
  });

  it.each`
    value        | expected
    ${"-P1DT2H"} | ${"P1DT2H"}
    ${"-PT90M"}  | ${"PT90M"}
    ${"-P1Y2M"}  | ${"P1Y2M"}
    ${"-PT1.5S"} | ${"PT1.5S"}
  `("negates negative $value to $expected", ({ value, expected }) => {
    expect(negateDuration(value)).toBe(expected);
  });

  // Calendar units need relativeTo for arithmetic and totalling, but not for a sign flip —
  // these rows prove negateDuration takes no such option and still answers.
  it.each`
    value        | expected
    ${"P1Y"}     | ${"-P1Y"}
    ${"P1M"}     | ${"-P1M"}
    ${"P1W"}     | ${"-P1W"}
    ${"P1Y1M1W"} | ${"-P1Y1M1W"}
  `(
    "negates calendar-unit $value to $expected without a relativeTo anchor",
    ({ value, expected }) => {
      expect(negateDuration(value)).toBe(expected);
    },
  );

  // Zero has no sign to flip; Temporal canonicalizes every zero duration to "PT0S".
  it.each`
    value       | expected
    ${"PT0S"}   | ${"PT0S"}
    ${"-PT0S"}  | ${"PT0S"}
    ${"P0D"}    | ${"PT0S"}
    ${"PT0H0M"} | ${"PT0S"}
  `(
    "negates the zero-length duration $value to $expected",
    ({ value, expected }) => {
      expect(negateDuration(value)).toBe(expected);
    },
  );

  it.each`
    value
    ${"P1DT2H"}
    ${"-P1Y2M3W4DT5H6M7.008S"}
    ${"PT0S"}
  `("round-trips $value back to itself when negated twice", ({ value }) => {
    expect(negateDuration(negateDuration(value))).toBe(value);
  });

  it.each`
    value
    ${"not a duration"}
    ${""}
    ${"P"}
    ${"1D"}
    ${"2024-03-10"}
    ${"PT"}
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `(
    "returns empty string when $value is not a valid duration string",
    ({ value }) => {
      expect(negateDuration(value)).toBe("");
    },
  );

  it("never throws on invalid input", () => {
    expect(() => negateDuration("not a duration")).not.toThrow();
  });
});
