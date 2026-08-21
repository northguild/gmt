import { resolveRelativeRounding } from "./resolveRelativeRounding";

describe("resolveRelativeRounding", () => {
  it.each`
    value   | method       | expected
    ${2.7}  | ${undefined} | ${3}
    ${2.7}  | ${"round"}   | ${3}
    ${2.4}  | ${"round"}   | ${2}
    ${2.7}  | ${"floor"}   | ${2}
    ${-2.7} | ${"floor"}   | ${-3}
    ${2.1}  | ${"ceil"}    | ${3}
    ${-2.7} | ${"ceil"}    | ${-2}
    ${2}    | ${"round"}   | ${2}
    ${0}    | ${"round"}   | ${0}
  `(
    "returns $expected for value $value with method $method",
    ({ value, method, expected }) => {
      expect(resolveRelativeRounding(value, method)).toBe(expected);
    },
  );

  it("rounds the signed fractional value directly, so floor on a negative distance moves further from zero", () => {
    // -2.7 is a "past" distance; floor must move it to -3, not toward 0.
    expect(resolveRelativeRounding(-2.7, "floor")).toBe(-3);
  });

  it("preserves a rounded negative-zero result rather than normalizing it to 0", () => {
    const result = resolveRelativeRounding(-0.4, "round");
    expect(result === 0).toBe(true);
    expect(Object.is(result, -0)).toBe(true);
  });

  it("defaults to round when method is omitted", () => {
    expect(resolveRelativeRounding(1.5)).toBe(2);
  });
});
