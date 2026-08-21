import { getDaysInMonth } from "./getDaysInMonth";

describe("getDaysInMonth", () => {
  it.each`
    value           | expected
    ${"2024-02-15"} | ${29}
    ${"2023-02-15"} | ${28}
    ${"2000-02-15"} | ${29}
    ${"1900-02-15"} | ${28}
    ${"2024-01-01"} | ${31}
    ${"2024-04-01"} | ${30}
    ${"2024-06-01"} | ${30}
    ${"2024-09-01"} | ${30}
    ${"2024-11-01"} | ${30}
    ${"2024-12-31"} | ${31}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(getDaysInMonth(value)).toBe(expected);
  });

  it.each`
    nonStringInput
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
    ${[]}
  `(
    "returns null for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(getDaysInMonth(nonStringInput)).toBeNull();
    },
  );
});
