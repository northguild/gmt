import { isObject } from "./isObject";

describe("isObject", () => {
  it.each`
    value                  | expected | kind
    ${{}}                  | ${true}  | ${"empty object"}
    ${{ smallestUnit: 1 }} | ${true}  | ${"object with keys"}
    ${[]}                  | ${true}  | ${"array (an object)"}
    ${null}                | ${false} | ${"null"}
    ${undefined}           | ${false} | ${"undefined"}
    ${0}                   | ${false} | ${"number"}
    ${""}                  | ${false} | ${"empty string"}
    ${"day"}               | ${false} | ${"string"}
    ${true}                | ${false} | ${"boolean"}
    ${Number.NaN}          | ${false} | ${"NaN"}
  `("returns $expected for $kind", ({ value, expected }) => {
    expect(isObject(value)).toBe(expected);
  });
});
