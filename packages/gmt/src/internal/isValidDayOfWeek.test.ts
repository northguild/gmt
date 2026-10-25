import { isValidDayOfWeek } from "./isValidDayOfWeek";

describe("isValidDayOfWeek", () => {
  it.each`
    dayOfWeek
    ${1}
    ${2}
    ${3}
    ${4}
    ${5}
    ${6}
    ${7}
  `("returns true for valid day-of-week: $dayOfWeek", ({ dayOfWeek }) => {
    expect(isValidDayOfWeek(dayOfWeek)).toBe(true);
  });

  it.each`
    invalidDayOfWeek  | type               | label
    ${0}              | ${"0"}             | ${"0"}
    ${8}              | ${"8"}             | ${"8"}
    ${1.5}            | ${"decimal"}       | ${"1.5"}
    ${-1}             | ${"negative"}      | ${"-1"}
    ${NaN}            | ${"NaN"}           | ${"NaN"}
    ${Infinity}       | ${"Infinity"}      | ${"Infinity"}
    ${-Infinity}      | ${"-Infinity"}     | ${"-Infinity"}
    ${"1"}            | ${"string"}        | ${"'1'"}
    ${""}             | ${"empty string"}  | ${"''"}
    ${{}}             | ${"object"}        | ${"{}"}
    ${[]}             | ${"array"}         | ${"[]"}
    ${true}           | ${"boolean true"}  | ${"true"}
    ${false}          | ${"boolean false"} | ${"false"}
    ${null}           | ${"null"}          | ${"null"}
    ${undefined}      | ${"undefined"}     | ${"undefined"}
    ${() => {}}       | ${"function"}      | ${"() => {}"}
    ${Symbol("test")} | ${"symbol"}        | ${"Symbol('test')"}
    ${BigInt(1)}      | ${"bigint"}        | ${"1n"}
    ${Object("1")}    | ${"String object"} | ${"Object('1')"}
  `(
    "returns false for invalid day-of-week ($type): $label",
    ({ invalidDayOfWeek }) => {
      expect(isValidDayOfWeek(invalidDayOfWeek as unknown as number)).toBe(
        false,
      );
    },
  );
});
