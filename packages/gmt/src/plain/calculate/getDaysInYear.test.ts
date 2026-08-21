import { getDaysInYear } from "./getDaysInYear";

describe("getDaysInYear", () => {
  it.each`
    value           | expected
    ${"2024-06-15"} | ${366}
    ${"2000-06-15"} | ${366}
    ${"2023-06-15"} | ${365}
    ${"1900-06-15"} | ${365}
    ${"2024-01-01"} | ${366}
    ${"2024-12-31"} | ${366}
    ${"2023-01-01"} | ${365}
    ${"2023-12-31"} | ${365}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(getDaysInYear(value)).toBe(expected);
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
      expect(getDaysInYear(nonStringInput)).toBeNull();
    },
  );
});
