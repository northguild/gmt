import { isObject, isOptionsArgument } from "./isObject";

describe("isObject", () => {
  it.each`
    value                  | expected | kind
    ${{}}                  | ${true}  | ${"empty object"}
    ${{ smallestUnit: 1 }} | ${true}  | ${"object with keys"}
    ${[]}                  | ${true}  | ${"array (an object)"}
    ${() => 0}             | ${true}  | ${"function (an object)"}
    ${class {}}            | ${true}  | ${"class (a function)"}
    ${null}                | ${false} | ${"null"}
    ${undefined}           | ${false} | ${"undefined"}
    ${0}                   | ${false} | ${"number"}
    ${""}                  | ${false} | ${"empty string"}
    ${"day"}               | ${false} | ${"string"}
    ${true}                | ${false} | ${"boolean"}
    ${Number.NaN}          | ${false} | ${"NaN"}
    ${Symbol("x")}         | ${false} | ${"symbol"}
    ${1n}                  | ${false} | ${"bigint"}
  `("returns $expected for $kind", ({ value, expected }) => {
    expect(isObject(value)).toBe(expected);
  });
});

describe("isOptionsArgument (Temporal GetOptionsObject)", () => {
  it.each`
    value                | expected | kind
    ${undefined}         | ${true}  | ${"undefined (the defaults)"}
    ${{}}                | ${true}  | ${"empty object"}
    ${{ overflow: "x" }} | ${true}  | ${"object with keys"}
    ${[]}                | ${true}  | ${"array (an object)"}
    ${() => 0}           | ${true}  | ${"function (an object)"}
    ${null}              | ${false} | ${"null (TypeError)"}
    ${"seconds"}         | ${false} | ${"string (TypeError)"}
    ${1}                 | ${false} | ${"number (TypeError)"}
    ${true}              | ${false} | ${"boolean (TypeError)"}
  `("returns $expected for $kind", ({ value, expected }) => {
    expect(isOptionsArgument(value)).toBe(expected);
  });
});
