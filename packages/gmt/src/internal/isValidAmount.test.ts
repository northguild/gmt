import { isValidAmount } from "./isValidAmount";

describe("isValidAmount", () => {
  it.each`
    validAmount
    ${0}
    ${-0}
    ${1}
    ${-1}
    ${Number.MAX_SAFE_INTEGER}
    ${-Number.MAX_SAFE_INTEGER}
    ${Number.MAX_VALUE}
    ${-Number.MAX_VALUE}
    ${Number.MIN_VALUE}
    ${-Number.MIN_VALUE}
    ${3.14}
    ${-3.14}
    ${1e10}
    ${-1e10}
  `("returns true for valid amount: $validAmount", ({ validAmount }) => {
    expect(isValidAmount(validAmount)).toBe(true);
  });

  it.each`
    invalidAmount       | type
    ${NaN}              | ${"NaN"}
    ${Infinity}         | ${"Infinity"}
    ${-Infinity}        | ${"-Infinity"}
    ${"string"}         | ${"string"}
    ${""}               | ${"empty string"}
    ${"42"}             | ${"numeric string"}
    ${{}}               | ${"object"}
    ${[]}               | ${"array"}
    ${true}             | ${"boolean true"}
    ${false}            | ${"boolean false"}
    ${null}             | ${"null"}
    ${undefined}        | ${"undefined"}
    ${() => {}}         | ${"function"}
    ${Symbol("test")}   | ${"symbol"}
    ${BigInt(42)}       | ${"bigint"}
    ${Object("string")} | ${"String object"}
  `(
    "returns false for invalid amount ($type): $invalidAmount",
    ({ invalidAmount }) => {
      expect(isValidAmount(invalidAmount as unknown as number)).toBe(false);
    },
  );
});
