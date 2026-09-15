import * as regex from "./index";
import { nanosecondDecimal } from "./nanoseconds";

describe("regex/nanosecondDecimal", () => {
  it.each`
    value                    | expected
    ${"1710072000123456789"} | ${true}
    ${"-1000000000"}         | ${true}
    ${"0"}                   | ${true}
    ${"-0"}                  | ${true}
    ${"9"}                   | ${true}
    ${"01"}                  | ${false}
    ${"-01"}                 | ${false}
    ${"1.5"}                 | ${false}
    ${"1e18"}                | ${false}
    ${"0x10"}                | ${false}
    ${"1_000"}               | ${false}
    ${"+1"}                  | ${false}
    ${" 1"}                  | ${false}
    ${"1 "}                  | ${false}
    ${"-"}                   | ${false}
    ${""}                    | ${false}
  `("matches $value as $expected", ({ value, expected }) => {
    expect(nanosecondDecimal.test(value)).toBe(expected);
  });

  it("is exported from the regex barrel", () => {
    expect(regex.nanosecondDecimal).toBe(nanosecondDecimal);
  });
});
