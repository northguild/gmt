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
    invalidAmount       | type                | label
    ${NaN}              | ${"NaN"}            | ${"NaN"}
    ${Infinity}         | ${"Infinity"}       | ${"Infinity"}
    ${-Infinity}        | ${"-Infinity"}      | ${"-Infinity"}
    ${"string"}         | ${"string"}         | ${"'string'"}
    ${""}               | ${"empty string"}   | ${"''"}
    ${"42"}             | ${"numeric string"} | ${"'42'"}
    ${{}}               | ${"object"}         | ${"{}"}
    ${[]}               | ${"array"}          | ${"[]"}
    ${true}             | ${"boolean true"}   | ${"true"}
    ${false}            | ${"boolean false"}  | ${"false"}
    ${null}             | ${"null"}           | ${"null"}
    ${undefined}        | ${"undefined"}      | ${"undefined"}
    ${() => {}}         | ${"function"}       | ${"() => {}"}
    ${Symbol("test")}   | ${"symbol"}         | ${"Symbol('test')"}
    ${BigInt(42)}       | ${"bigint"}         | ${"42n"}
    ${Object("string")} | ${"String object"}  | ${"Object('string')"}
  `("returns false for invalid amount ($type): $label", ({ invalidAmount }) => {
    expect(isValidAmount(invalidAmount as unknown as number)).toBe(false);
  });
});
