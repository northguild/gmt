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
    invalidDayOfWeek  | type
    ${0}              | ${"0"}
    ${8}              | ${"8"}
    ${1.5}            | ${"decimal"}
    ${-1}             | ${"negative"}
    ${NaN}            | ${"NaN"}
    ${Infinity}       | ${"Infinity"}
    ${-Infinity}      | ${"-Infinity"}
    ${"1"}            | ${"string"}
    ${""}             | ${"empty string"}
    ${{}}             | ${"object"}
    ${[]}             | ${"array"}
    ${true}           | ${"boolean true"}
    ${false}          | ${"boolean false"}
    ${null}           | ${"null"}
    ${undefined}      | ${"undefined"}
    ${() => {}}       | ${"function"}
    ${Symbol("test")} | ${"symbol"}
    ${BigInt(1)}      | ${"bigint"}
    ${Object("1")}    | ${"String object"}
  `(
    "returns false for invalid day-of-week ($type): $invalidDayOfWeek",
    ({ invalidDayOfWeek }) => {
      expect(isValidDayOfWeek(invalidDayOfWeek as unknown as number)).toBe(
        false,
      );
    },
  );
});
