import { absDuration } from "./absDuration";

describe("absDuration", () => {
  it.each`
    value              | expected
    ${"-P1DT2H"}       | ${"P1DT2H"}
    ${"-PT90M"}        | ${"PT90M"}
    ${"-P1Y2M3W4DT5H"} | ${"P1Y2M3W4DT5H"}
    ${"-P400D"}        | ${"P400D"}
    ${"-PT1.5S"}       | ${"PT1.5S"}
  `("returns $expected for negative $value", ({ value, expected }) => {
    expect(absDuration(value)).toBe(expected);
  });

  // The no-effect case: an already-positive duration must pass through unchanged rather
  // than be rejected or double-flipped.
  it.each`
    value             | expected
    ${"P1DT2H"}       | ${"P1DT2H"}
    ${"PT90M"}        | ${"PT90M"}
    ${"P1Y2M3W4DT5H"} | ${"P1Y2M3W4DT5H"}
    ${"PT1.5S"}       | ${"PT1.5S"}
  `("leaves already-positive $value as $expected", ({ value, expected }) => {
    expect(absDuration(value)).toBe(expected);
  });

  it.each`
    value         | expected
    ${"-P1Y"}     | ${"P1Y"}
    ${"-P1M"}     | ${"P1M"}
    ${"-P1W"}     | ${"P1W"}
    ${"-P1Y1M1W"} | ${"P1Y1M1W"}
  `(
    "returns $expected for calendar-unit $value without a relativeTo anchor",
    ({ value, expected }) => {
      expect(absDuration(value)).toBe(expected);
    },
  );

  it.each`
    value      | expected
    ${"PT0S"}  | ${"PT0S"}
    ${"-PT0S"} | ${"PT0S"}
    ${"P0D"}   | ${"PT0S"}
    ${"-P0D"}  | ${"PT0S"}
  `(
    "returns $expected for the zero-length duration $value",
    ({ value, expected }) => {
      expect(absDuration(value)).toBe(expected);
    },
  );

  it.each`
    value
    ${"-P1DT2H"}
    ${"P1DT2H"}
    ${"PT0S"}
  `("is idempotent for $value", ({ value }) => {
    expect(absDuration(absDuration(value))).toBe(absDuration(value));
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
      expect(absDuration(value)).toBe("");
    },
  );

  it("never throws on invalid input", () => {
    expect(() => absDuration("not a duration")).not.toThrow();
  });
});
