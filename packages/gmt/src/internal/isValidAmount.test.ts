import { isValidAmount } from "./isValidAmount";

describe("isValidAmount", () => {
  it.each`
    validAmount
    ${0}
    ${-1}
    ${1}
    ${3.14}
    ${-3.14}
  `("returns true for valid amount: $validAmount", ({ validAmount }) => {
    expect(isValidAmount(validAmount)).toBe(true);
  });

  it.each`
    invalidAmount
    ${NaN}
    ${Infinity}
    ${-Infinity}
    ${"string"}
    ${{}}
    ${[]}
    ${true}
    ${false}
    ${null}
    ${undefined}
  `("returns false for invalid amount: $invalidAmount", ({ invalidAmount }) => {
    expect(isValidAmount(invalidAmount)).toBe(false);
  });
});
