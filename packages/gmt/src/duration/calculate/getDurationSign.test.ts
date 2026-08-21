import { getDurationSign } from "./getDurationSign";

describe("getDurationSign", () => {
  it.each`
    value                     | expected
    ${"P1DT2H"}               | ${1}
    ${"PT90M"}                | ${1}
    ${"PT1.5S"}               | ${1}
    ${"PT0.000000001S"}       | ${1}
    ${"P1Y2M3W4DT5H6M7.008S"} | ${1}
  `("returns $expected for positive $value", ({ value, expected }) => {
    expect(getDurationSign(value)).toBe(expected);
  });

  it.each`
    value                      | expected
    ${"-P1DT2H"}               | ${-1}
    ${"-PT90M"}                | ${-1}
    ${"-PT1.5S"}               | ${-1}
    ${"-PT0.000000001S"}       | ${-1}
    ${"-P1Y2M3W4DT5H6M7.008S"} | ${-1}
  `("returns $expected for negative $value", ({ value, expected }) => {
    expect(getDurationSign(value)).toBe(expected);
  });

  // Zero is its own result, not folded into the positive case — and a negated zero is
  // still zero, so "-PT0S" is 0 rather than -1.
  it.each`
    value       | expected
    ${"PT0S"}   | ${0}
    ${"-PT0S"}  | ${0}
    ${"P0D"}    | ${0}
    ${"-P0D"}   | ${0}
    ${"PT0H0M"} | ${0}
  `(
    "returns $expected for the zero-length duration $value",
    ({ value, expected }) => {
      expect(getDurationSign(value)).toBe(expected);
    },
  );

  it.each`
    value     | expected
    ${"P1Y"}  | ${1}
    ${"-P1Y"} | ${-1}
    ${"P1M"}  | ${1}
    ${"P1W"}  | ${1}
    ${"-P1W"} | ${-1}
  `(
    "returns $expected for calendar-unit $value without a relativeTo anchor",
    ({ value, expected }) => {
      expect(getDurationSign(value)).toBe(expected);
    },
  );

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
  `("returns null when $value is not a valid duration string", ({ value }) => {
    expect(getDurationSign(value)).toBeNull();
  });

  it("distinguishes the invalid-input null from a valid zero-length duration's 0", () => {
    expect(getDurationSign("PT0S")).toBe(0);
    expect(getDurationSign("not a duration")).toBeNull();
  });

  it("never throws on invalid input", () => {
    expect(() => getDurationSign("not a duration")).not.toThrow();
  });
});
